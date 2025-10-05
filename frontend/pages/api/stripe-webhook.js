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

  let event
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  try {
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object
      const metadata = paymentIntent.metadata || {}
      const ticketIds = metadata.ticketIds?.split(',') || []

      if (ticketIds.length === 0) {
        console.warn('⚠ No ticket IDs in metadata')
        return res.status(400).send('Missing ticket IDs')
      }

      // Update each ticket individually
      for (const ticketId of ticketIds) {
        const { rows: regRows } = await pool.query(
          `UPDATE registrations
           SET has_paid = TRUE,
               paid_at = NOW(),
               stage = 'book'
           WHERE id=$1
           RETURNING id, ticket_sent, email, user_id`,
          [ticketId]
        )

        if (regRows.length > 0) {
          const reg = regRows[0]
          if (!reg.ticket_sent && reg.email) {
            // Fetch user and event info
            const { rows: userRows } = await pool.query(
              'SELECT id, username, email FROM user_profiles WHERE id=$1',
              [reg.user_id]
            )
            const user = userRows[0]

            const { rows: eventRows } = await pool.query(
              `SELECT e.*
               FROM registrations r
               JOIN events e ON e.id = r.event_id
               WHERE r.id=$1`,
              [ticketId]
            )
            const eventObj = eventRows[0]

            try {
              await sendTicketEmail(reg.email, eventObj, user, pool)
              await pool.query('UPDATE registrations SET ticket_sent=TRUE WHERE id=$1', [ticketId])
              console.log(`🎟 Ticket email sent → ${reg.email}`)
            } catch (err) {
              console.error('❌ Failed to send ticket email:', err)
            }
          }
        }
      }

      console.log(`✅ Payment recorded for ${ticketIds.length} tickets`)
    }

    res.status(200).send('Webhook received')
  } catch (err) {
    console.error('❌ Error processing webhook:', err)
    res.status(500).send('Internal Server Error')
  }
}

