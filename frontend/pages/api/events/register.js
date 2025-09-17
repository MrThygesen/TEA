// pages/api/events/register.js
import { pool } from '../../../lib/postgres.js'
import Stripe from 'stripe'
import { auth } from '../../../lib/auth.js'
import {
  sendPrebookEmail,
  sendBookingReminderEmail,
  sendTicketEmail,
} from '../../../lib/email.js'
import QRCode from 'qrcode'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' })
  }

  // --- auth ---
  const token = auth.getTokenFromReq(req)
  if (!token) return res.status(401).json({ error: 'Not authenticated' })

  let user
  try {
    user = auth.verifyToken(token) // must contain { id, email, username }
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }

  const { eventId } = req.body
  if (!eventId) return res.status(400).json({ error: 'Missing eventId' })

  try {
    // --- fetch event ---
    const { rows } = await pool.query('SELECT * FROM events WHERE id=$1', [eventId])
    const event = rows[0]
    if (!event) return res.status(404).json({ error: 'Event not found' })

    // --- prebook (always add user to registrations) ---
    await pool.query(
      `INSERT INTO registrations (event_id, user_id, email)
       VALUES ($1, $2, $3)
       ON CONFLICT (event_id, user_id) DO NOTHING`,
      [eventId, user.id, user.email]
    )

    // ✅ send prebook confirmation immediately
    if (user.email) {
      await sendPrebookEmail(user.email, event)
    }

    // --- check if event becomes confirmed ---
    const { rows: prebookRows } = await pool.query(
      'SELECT COUNT(*)::int AS count FROM registrations WHERE event_id=$1',
      [eventId]
    )
    const registeredCount = prebookRows[0]?.count || 0

    if (registeredCount >= event.min_attendees && !event.is_confirmed) {
      await pool.query('UPDATE events SET is_confirmed=true WHERE id=$1', [eventId])

      // email all prebooked users
      const { rows: users } = await pool.query(
        `SELECT u.email, u.username
         FROM registrations r
         JOIN user_profiles u ON r.user_id=u.id
         WHERE r.event_id=$1`,
        [eventId]
      )
      await Promise.all(users.map(u => sendBookingReminderEmail(u.email, event)))
    }

    // --- if paid event → stripe checkout ---
    if (event.price && Number(event.price) > 0) {
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
        metadata: {
          eventId: String(eventId),
          userId: String(user.id),
        },
        customer_email: user.email || undefined,
      })
      return res.status(200).json({ url: session.url })
    }

    // --- free event → issue ticket immediately ---
    const qrData = `ticket:${event.id}:${user.id}`
    const qrImage = await QRCode.toDataURL(qrData)

    // mark ticket as sent
    await pool.query(
      `UPDATE registrations 
       SET ticket_sent=true 
       WHERE event_id=$1 AND user_id=$2`,
      [event.id, user.id]
    )

    if (user.email) {
      await sendTicketEmail(user.email, event, user, qrImage)
    }

    return res.status(200).json({ message: 'Registered successfully (free ticket issued)' })
  } catch (err) {
    console.error('❌ register error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

