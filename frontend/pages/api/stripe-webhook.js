// pages/api/stripe-webhook.js
import Stripe from 'stripe'
import { buffer } from 'micro'
import { pool } from '../../lib/postgres.js'
import { sendTicketEmail } from '../../lib/email.js'
import { setEventCache, invalidateEventCache } from '../../lib/cache.js'

export const config = {
  api: { bodyParser: false }, // Stripe kræver rå body for at verificere signature
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed')
  }

  const sig = req.headers['stripe-signature']
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  let event
  try {
    const buf = await buffer(req)
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret)
  } catch (err) {
    console.error('❌ Stripe signature verification failed:', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  try {
    // 🎯 Handle successful payment intent
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const email = session.customer_details?.email
      const eventId = session.metadata?.eventId
      const userId = session.metadata?.userId
      const quantity = parseInt(session.metadata?.quantity || '1', 10)

      if (!email || !eventId || !userId) {
        console.warn('⚠️ Missing metadata in Stripe session:', session.id)
        return res.status(200).json({ received: true })
      }

      console.log(`💰 Payment success for ${email} → ${quantity} ticket(s) to event ${eventId}`)

      // ✅ 1. Mark registrations as paid or create new ones
      const existing = await pool.query(
        `SELECT id FROM registrations WHERE event_id=$1 AND user_id=$2`,
        [eventId, userId]
      )

      if (existing.rows.length) {
        await pool.query(
          `UPDATE registrations
           SET has_paid=TRUE, updated_at=NOW()
           WHERE event_id=$1 AND user_id=$2`,
          [eventId, userId]
        )
      } else {
        for (let i = 0; i < quantity; i++) {
          const ticketCode = `ticket:${eventId}:${userId}:${Date.now()}-${i}`
          await pool.query(
            `INSERT INTO registrations (event_id, user_id, email, stage, has_paid, ticket_code)
             VALUES ($1, $2, $3, 'book', TRUE, $4)`,
            [eventId, userId, email, ticketCode]
          )
        }
      }

      // ✅ 2. Fetch event + user info for email
      const { rows: events } = await pool.query('SELECT * FROM events WHERE id=$1', [eventId])
      const { rows: users } = await pool.query('SELECT * FROM user_profiles WHERE id=$1', [userId])
      const eventData = events[0]
      const user = users[0]

      if (eventData && user) {
        // ✅ 3. Send professional confirmation email
        await sendTicketEmail(email, eventData, user, pool)

        // ✅ 4. Update cache layer (cdump + per-event)
        await setEventCache(`registration-${eventId}`, { total: quantity })
        await invalidateEventCache(`registration-${eventId}`)
      }

      return res.status(200).json({ received: true })
    }

    // 🧾 Handle refund or failed payment
    if (event.type === 'charge.refunded') {
      const charge = event.data.object
      const eventId = charge.metadata?.eventId
      const userId = charge.metadata?.userId

      if (eventId && userId) {
        await pool.query(
          `UPDATE registrations
           SET has_paid=FALSE, updated_at=NOW()
           WHERE event_id=$1 AND user_id=$2`,
          [eventId, userId]
        )
        await invalidateEventCache(`registration-${eventId}`)
        console.log(`💸 Refund processed for user ${userId} (event ${eventId})`)
      }
      return res.status(200).json({ received: true })
    }

    // Default handler
    return res.status(200).json({ received: true })
  } catch (err) {
    console.error('❌ Stripe webhook handler error:', err)
    return res.status(500).send(`Webhook handler failed: ${err.message}`)
  }
}

