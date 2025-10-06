// pages/api/stripe-webhook.js
import Stripe from 'stripe'
import { pool } from '../../lib/postgres.js'
import { sendTicketEmail } from '../../lib/email.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export const config = { api: { bodyParser: false } }

async function buffer(readable) {
  const chunks = []
  for await (const chunk of readable)
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  return Buffer.concat(chunks)
}

export default async function handler(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' })

  const sig = req.headers['stripe-signature']
  const buf = await buffer(req)
  let event

  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('❌ Stripe webhook signature verification failed', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const { eventId, userId, email, quantity } = session.metadata || {}

    console.log('✅ Stripe session completed:', { eventId, userId, email, quantity })

    try {
      const { rows: eventRows } = await pool.query('SELECT * FROM events WHERE id=$1', [eventId])
      if (!eventRows.length) throw new Error('Event not found')
      const eventInfo = eventRows[0]

      const dbUserId = userId === 'guest' ? null : userId

      // --- Fetch only tickets for this session
      const { rows: sessionTickets } = await pool.query(
        `SELECT * FROM registrations
         WHERE event_id=$1
           AND (user_id=$2 OR email=$3)
           AND stage='prebook'
         ORDER BY id ASC
         LIMIT $4`,
        [eventId, dbUserId, email, quantity]
      )

      if (!sessionTickets.length) {
        console.warn('⚠ No prebooked tickets found for this session.')
        return res.status(200).json({ received: true })
      }

      const ticketIds = sessionTickets.map(t => t.id)

      // --- Update only these tickets to paid
      await pool.query(
        `UPDATE registrations
         SET has_paid = TRUE,
             stage = 'book'
         WHERE id = ANY($1::int[])`,
        [ticketIds]
      )

      // --- Send tickets for this session only
      if (email) {
        try {
          // sendTicketEmail should accept a **list of specific tickets**
          await sendTicketEmail(email, eventInfo, { id: dbUserId, email }, pool, ticketIds)
          console.log(`✅ Sent ${ticketIds.length} ticket(s) to ${email}`)
        } catch (err) {
          console.error('❌ Error sending paid ticket email:', err)
        }
      }

      return res.status(200).json({ received: true })
    } catch (err) {
      console.error('❌ Stripe webhook handling error:', err)
      return res.status(500).json({ error: err.message })
    }
  }

  res.status(200).json({ received: true })
}

