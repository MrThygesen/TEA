// pages/api/events/register.js
import { pool } from '../../../lib/postgres.js'
import Stripe from 'stripe'
import { auth } from '../../../lib/auth.js'
import { sendPrebookEmail, sendBookingReminderEmail, sendTicketEmail } from '../../../lib/email.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

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
    // --- fetch event ---
    const { rows } = await pool.query('SELECT * FROM events WHERE id=$1', [eventId])
    const event = rows[0]
    if (!event) return res.status(404).json({ error: 'Event not found' })

    // --- upsert registration ---
    await pool.query(
      `INSERT INTO registrations (event_id, user_id, email, wallet_address)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (event_id,user_id) DO NOTHING`,
      [eventId, user.id, user.email, user.wallet_address]
    )

    // helper: get updated count
    const { rows: countRows } = await pool.query(
      'SELECT COUNT(*)::int AS count FROM registrations WHERE event_id=$1',
      [eventId]
    )
    const registeredCount = countRows[0]?.count || 0

    // --- STAGE: PREBOOK / guestlist ---
    if (stage === 'prebook') {
      if (user.email) await sendPrebookEmail(user.email, event)

      // auto-confirm event if min_attendees reached
      if (registeredCount >= event.min_attendees && !event.is_confirmed) {
        await pool.query('UPDATE events SET is_confirmed=true WHERE id=$1', [eventId])

        const { rows: users } = await pool.query(
          `SELECT u.email
           FROM registrations r
           JOIN user_profiles u ON r.user_id=u.id
           WHERE r.event_id=$1`,
          [eventId]
        )

        await Promise.all(
          users.filter(u => u.email).map(u => sendBookingReminderEmail(u.email, event))
        )
      }

      return res.status(200).json({
        message: 'You are on the guestlist ✅',
        registeredCount,
      })
    }

    // --- STAGE: BOOK ---
    if (stage === 'book') {
      if (!event.price || Number(event.price) === 0) {
        // free event → send ticket
        await pool.query(
          `UPDATE registrations 
           SET ticket_sent=true 
           WHERE event_id=$1 AND user_id=$2`,
          [eventId, user.id]
        )

        if (user.email) await sendTicketEmail(user.email, event, user)

        return res.status(200).json({
          message: 'Ticket sent successfully 🎟️',
          registeredCount,
        })
      }

      // paid event → Stripe checkout
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: { name: event.name },
            unit_amount: Math.round(Number(event.price) * 100),
          },
          quantity: 1,
        }],
        success_url: `${process.env.FRONTEND_URL}/success?event=${eventId}&user=${user.id}`,
        cancel_url: `${process.env.FRONTEND_URL}/cancel?event=${eventId}`,
        metadata: { eventId: String(eventId), userId: String(user.id) },
        customer_email: user.email || undefined,
      })

      return res.status(200).json({
        url: session.url,
        registeredCount,
      })
    }

    return res.status(400).json({ error: 'Invalid stage', registeredCount })
  } catch (err) {
    console.error('❌ register error:', err)
    return res.status(500).json({ error: 'Internal server error', details: err.message })
  }
}

