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
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const eventId = session.metadata?.eventId
      const userId = session.metadata?.userId // web user
      const telegramUserId = session.metadata?.telegramId // telegram user

      if (!eventId || (!userId && !telegramUserId)) {
        console.warn('⚠ Missing metadata:', session.id, session.metadata)
        return res.status(400).send('Missing metadata')
      }

      // --- WEB USER FLOW ---
      if (userId) {
        await pool.query(
          `INSERT INTO registrations (event_id, user_id, email, status)
           VALUES ($1, $2, $3, 'pending')
           ON CONFLICT (event_id, user_id) DO NOTHING`,
          [eventId, userId, session.customer_details?.email || null]
        )

        const { rows: regRows } = await pool.query(
          `UPDATE registrations
           SET has_paid = TRUE,
               paid_at = NOW(),
               status = 'confirmed'
           WHERE event_id = $1 AND user_id = $2
           RETURNING id, ticket_sent`,
          [eventId, userId]
        )

        if (regRows.length > 0) {
          const reg = regRows[0]
          console.log(`✅ Payment recorded (WEB) for event ${eventId}, user ${userId}`)

          if (!reg.ticket_sent) {
            const { rows: userRows } = await pool.query(
              'SELECT id, username, email FROM user_profiles WHERE id=$1',
              [userId]
            )
            const user = userRows[0]

            const { rows: eventRows } = await pool.query(
              'SELECT * FROM events WHERE id=$1',
              [eventId]
            )
            const eventObj = eventRows[0]

            if (user && eventObj && user.email) {
              try {
                const eventWithDetails = {
                  ...eventObj,
                  detailsBlock: `
                    <h2 style="margin-top:20px;">Event Details</h2>
                    <p>${eventObj.details || 'No details provided.'}</p>
                    <p style="margin-top:20px;">
                      <label style="display:flex;align-items:center;gap:8px;">
                        <input type="checkbox" disabled checked />
                        I declare to have a relevance for the network event according to the description above
                      </label>
                    </p>
                  `,
                }

                await sendTicketEmail(user.email, eventWithDetails, user)

                await pool.query(
                  'UPDATE registrations SET ticket_sent = TRUE WHERE id = $1',
                  [reg.id]
                )
                console.log(`🎟 Ticket email sent → ${user.email}`)
              } catch (err) {
                console.error('❌ Failed to send ticket email:', err)
              }
            }
          } else {
            console.log(`ℹ Ticket already sent for registration ${reg.id}, skipping`)
          }
        }
      }

      // --- TELEGRAM USER FLOW ---
      else if (telegramUserId) {
        await pool.query(
          `INSERT INTO registrations (event_id, telegram_user_id, email, status)
           VALUES ($1, $2, $3, 'pending')
           ON CONFLICT (event_id, telegram_user_id) DO NOTHING`,
          [eventId, telegramUserId, session.customer_details?.email || null]
        )

        const { rowCount } = await pool.query(
          `UPDATE registrations
           SET has_paid = TRUE,
               paid_at = NOW(),
               status = 'confirmed'
           WHERE event_id = $1 AND telegram_user_id = $2`,
          [eventId, telegramUserId]
        )

        if (rowCount > 0) {
          console.log(
            `✅ Payment recorded (TELEGRAM) for event ${eventId}, user ${telegramUserId}`
          )
          // Telegram users don’t get email
        }
      }
    }

    res.status(200).send('Webhook received')
  } catch (err) {
    console.error('❌ Error processing webhook:', err)
    res.status(500).send('Internal Server Error')
  }
}

