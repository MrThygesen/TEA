// pages/api/events/register.js
import { pool } from '../../../lib/postgres.js'
import Stripe from 'stripe'
import crypto from 'crypto'
import { auth } from '../../../lib/auth.js'
import { sendPrebookEmail, sendBookingReminderEmail, sendTicketEmail } from '../../../lib/email.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' })

  // Prevent 304 caching
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  res.setHeader('Surrogate-Control', 'no-store')

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
    // --- Fetch event ---
    const { rows: eventRows } = await pool.query('SELECT * FROM events WHERE id=$1', [eventId])
    const event = eventRows[0]
    if (!event) return res.status(404).json({ error: 'Event not found' })

    // --- Enforce ticket limits ---
    const { rows: userTickets } = await pool.query(
      `SELECT COUNT(*)::int AS count 
       FROM registrations
       WHERE event_id=$1 
         AND stage='book'
         AND (
           (user_id IS NOT NULL AND user_id=$2) OR
           (telegram_user_id IS NOT NULL AND telegram_user_id=$3)
         )`,
      [eventId, user.id || null, user.telegram_user_id || null]
    )
    const currentCount = userTickets[0]?.count || 0
    const maxTickets = event.tag1 === 'group' ? 10 : 1

    if (stage === 'book' && currentCount >= maxTickets) {
      return res.status(400).json({
        error: `You already reached the max ticket limit (${maxTickets}) for this event.`,
      })
    }

    // --- Check existing registration ---
    const { rows: existingRows } = await pool.query(
      `SELECT * FROM registrations
       WHERE event_id=$1 AND (
         (user_id IS NOT NULL AND user_id=$2) OR
         (telegram_user_id IS NOT NULL AND telegram_user_id=$3)
       )`,
      [eventId, user.id || null, user.telegram_user_id || null]
    )

    let ticketCode = null

    if (existingRows.length > 0) {
      // Existing registration
      const existing = existingRows[0]

      // Auto-upgrade prebook -> book if event is confirmed
      let newStage = stage
      if (existing.stage === 'prebook' && event.is_confirmed && stage === 'prebook') {
        newStage = 'book'
      }

      if (newStage === 'book') {
        // Assign ticket code if missing
        ticketCode = existing.ticket_code || crypto.randomBytes(8).toString('hex')
        await pool.query(
          `UPDATE registrations
           SET stage='book',
               email=$1,
               wallet_address=$2,
               ticket_code=$3,
               timestamp=CURRENT_TIMESTAMP
           WHERE id=$4`,
          [user.email || null, user.wallet_address || null, ticketCode, existing.id]
        )
      } else {
        await pool.query(
          `UPDATE registrations
           SET stage='prebook',
               email=$1,
               wallet_address=$2,
               timestamp=CURRENT_TIMESTAMP
           WHERE id=$3`,
          [user.email || null, user.wallet_address || null, existing.id]
        )
      }
    } else {
      // New registration
      if (stage === 'book' || event.is_confirmed) {
        ticketCode = crypto.randomBytes(8).toString('hex')
        await pool.query(
          `INSERT INTO registrations
           (event_id, user_id, telegram_user_id, telegram_username, email, wallet_address, ticket_code, stage, timestamp)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'book',CURRENT_TIMESTAMP)`,
          [
            eventId,
            user.id || null,
            user.telegram_user_id || null,
            user.telegram_username || null,
            user.email || null,
            user.wallet_address || null,
            ticketCode
          ]
        )
      } else {
        await pool.query(
          `INSERT INTO registrations
           (event_id, user_id, telegram_user_id, telegram_username, email, wallet_address, stage, timestamp)
           VALUES ($1,$2,$3,$4,$5,$6,'prebook',CURRENT_TIMESTAMP)`,
          [
            eventId,
            user.id || null,
            user.telegram_user_id || null,
            user.telegram_username || null,
            user.email || null,
            user.wallet_address || null,
          ]
        )
      }
    }

    // --- Registered count ---
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*)::int AS count 
       FROM registrations 
       WHERE event_id=$1 AND stage='book'`,
      [eventId]
    )
    const registeredCount = countRows[0]?.count || 0

    // --- Handle prebook ---
    if (stage === 'prebook' && !event.is_confirmed) {
      if (user.email) await sendPrebookEmail(user.email, event)

      // Confirm event if min_attendees reached
      if (registeredCount >= event.min_attendees && !event.is_confirmed) {
        await pool.query('UPDATE events SET is_confirmed=true WHERE id=$1', [eventId])

        const { rows: users } = await pool.query(
          `SELECT u.email
           FROM registrations r
           JOIN user_profiles u ON r.user_id=u.id
           WHERE r.event_id=$1 AND r.stage='prebook'`,
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

    // --- Handle book ---
    if (stage === 'book' || event.is_confirmed) {
      // Free event → send ticket immediately
      if (!event.price || Number(event.price) === 0) {
        if (user.id) {
          await pool.query(
            `UPDATE registrations SET ticket_sent=true WHERE event_id=$1 AND user_id=$2`,
            [eventId, user.id]
          )
        } else if (user.telegram_user_id) {
          await pool.query(
            `UPDATE registrations SET ticket_sent=true WHERE event_id=$1 AND telegram_user_id=$2`,
            [eventId, user.telegram_user_id]
          )
        }

        if (user.email)
          await sendTicketEmail(user.email, event, { ...user, ticket_code: ticketCode })

        return res.status(200).json({
          message: 'Ticket sent successfully 🎟️',
          registeredCount,
        })
      }

      // Paid event → Stripe checkout
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

