//pages/api/stripe-webhook.js

import Stripe from 'stripe'
import { buffer } from 'micro'
import { pool } from '../../lib/postgres.js'
import { sendTicketEmail } from '../../lib/email.js'

export const config = { api: { bodyParser: false } }
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed')

  const sig = req.headers['stripe-signature']
  const buf = await buffer(req)

  try {
    const event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    )

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const eventId = session.metadata?.eventId
      const userId = session.metadata?.userId
      const quantity = parseInt(session.metadata?.quantity || '1', 10)

      if (!eventId) {
        console.warn('⚠ Missing eventId in metadata')
        return res.status(400).send('Missing metadata')
      }

      // Mark all unpaid tickets for this user & event as paid
      const { rows: tickets } = await pool.query(
        `UPDATE registrations
         SET has_paid=TRUE, paid_at=NOW(), stage='book'
         WHERE event_id=$1 AND user_id=$2 AND has_paid=FALSE
         RETURNING id, email, ticket_sent`,
        [eventId, userId === 'guest' ? null : userId]
      )

      if (tickets.length === 0) {
        console.log('ℹ️ No pending tickets found for session', session.id)
        return res.status(200).send('No tickets to update')
      }

      const { rows: eventRows } = await pool.query('SELECT * FROM events WHERE id=$1', [eventId])
      const eventObj = eventRows[0]

      // Find user email
      let email = tickets[0].email
      if (!email && userId && userId !== 'guest') {
        const { rows } = await pool.query('SELECT email FROM user_profiles WHERE id=$1', [userId])
        email = rows[0]?.email
      }

      if (email) {
        for (const ticket of tickets) {
          if (!ticket.ticket_sent) {
            await sendTicketEmail(email, eventObj, { id: userId, email })
          }
        }
        await pool.query('UPDATE registrations SET ticket_sent=TRUE WHERE id=ANY($1::int[])', [tickets.map(t => t.id)])
        console.log(`✅ Sent ${tickets.length} ticket(s) to ${email}`)
      }
    }

    res.status(200).send('OK')
  } catch (err) {
    console.error('❌ Stripe webhook error:', err)
    res.status(400).send(`Webhook Error: ${err.message}`)
  }
}

