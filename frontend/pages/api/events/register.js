import { pool } from '../../../lib/postgres.js'
import Stripe from 'stripe' 
import { auth } from '../../../lib/auth.js'
import {
  sendPrebookEmail,
  sendBookingReminderEmail,
  sendTicketEmail,
} from '../../../lib/email.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // --- auth ---
  const token = auth.getTokenFromReq(req)
  if (!token) return res.status(401).json({ error: 'Not authenticated' })

  let user
  try {
    user = auth.verifyToken(token)
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }

  const { eventId, stage } = req.body
  if (!eventId) return res.status(400).json({ error: 'Missing eventId' })
  if (!stage) return res.status(400).json({ error: 'Missing stage' })

  try {
    const { rows } = await pool.query('SELECT * FROM events WHERE id=$1', [eventId])
    const event = rows[0]
    if (!event) return res.status(404).json({ error: 'Event not found' })

    // --- always insert registration if missing ---
    await pool.query(
      `INSERT INTO registrations (event_id, user_id, email)
       VALUES ($1,$2,$3)
       ON CONFLICT (event_id,user_id) DO NOTHING`,
      [eventId, user.id, user.email]
    )

    // -------------------------------------------------
    // STAGE: PREBOOK
    // -------------------------------------------------
    if (stage === 'prebook') {
      if (user.email) {
        await sendPrebookEmail(user.email, event)
      }

      // check if event becomes confirmed
      const { rows: prebookRows } = await pool.query(
        'SELECT COUNT(*)::int AS count FROM registrations WHERE event_id=$1',
        [eventId]
      )
      const registeredCount = prebookRows[0]?.count || 0

      if (registeredCount >= event.min_attendees && !event.is_confirmed) {
        await pool.query('UPDATE events SET is_confirmed=true WHERE id=$1', [eventId])

        // notify all prebooked users
        const { rows: users } = await pool.query(
          `SELECT u.email, u.username
           FROM registrations r
           JOIN user_profiles u ON r.user_id=u.id
           WHERE r.event_id=$1`,
          [eventId]
        )
        await Promise.all(users.map(u => sendBookingReminderEmail(u.email, event)))
      }

      return res.status(200).json({ message: 'Prebook confirmed' })
    }

    // -------------------------------------------------
    // STAGE: BOOK
    // -------------------------------------------------
    if (stage === 'book') {
      // FREE EVENT → send ticket with QR
      if (!event.price || Number(event.price) === 0) {
        const { rows: userRows } = await pool.query(
          'SELECT id, username, email FROM user_profiles WHERE id=$1',
          [user.id]
        )
        const dbUser = userRows[0]

        await pool.query(
          `UPDATE registrations 
           SET ticket_sent=true 
           WHERE event_id=$1 AND user_id=$2`,
          [event.id, dbUser.id]
        )

        if (dbUser?.email) {
          await sendTicketEmail(dbUser.email, event, dbUser)
        }

        return res.status(200).json({ message: 'Free ticket sent successfully' })
      }

      // PAID EVENT → Stripe checkout session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: { name: event.name },
              unit_amount: Math.round(Number(event.price) * 100),
            },
            quantity: 1,
          },
        ],
        success_url: `${process.env.FRONTEND_URL}/success?event=${eventId}&user=${user.id}`,
        cancel_url: `${process.env.FRONTEND_URL}/cancel?event=${eventId}`,
        metadata: { eventId: String(eventId), userId: String(user.id) },
        customer_email: user.email || undefined,
      })

      return res.status(200).json({ url: session.url })
    }

    // -------------------------------------------------
    // fallback (invalid stage)
    // -------------------------------------------------
    return res.status(400).json({ error: 'Invalid stage value' })
  } catch (err) {
    console.error('❌ register error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

