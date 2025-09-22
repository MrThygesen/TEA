// pages/api/events/register.js
import { pool } from '../../../lib/postgres.js'
import { auth } from '../../../lib/auth.js'
import Stripe from 'stripe'
import crypto from 'crypto'
import { sendTicketEmail, sendBookingReminderEmail } from '../../../lib/email.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    // --------------------------
    // Auth
    // --------------------------
    const token = auth.getTokenFromReq(req)
    if (!token) return res.status(401).json({ error: 'Not authenticated' })

    let user
    try {
      user = auth.verifyToken(token)
    } catch {
      return res.status(401).json({ error: 'Invalid token' })
    }

    const userId = user.id || null
    const telegramUserId = user.telegram_user_id || null
    if (!userId && !telegramUserId) return res.status(400).json({ error: 'No valid user in token' })

    // --------------------------
    // Input
    // --------------------------
    const { eventId } = req.body
    if (!eventId) return res.status(400).json({ error: 'Missing eventId' })

    // Fetch event
    const { rows: events } = await pool.query(
      `SELECT * FROM events WHERE id=$1`,
      [eventId]
    )
    if (!events.length) return res.status(404).json({ error: 'Event not found' })
    const event = events[0]

    // Count current bookings (stage='book')
    const { rows: regRows } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM registrations WHERE event_id=$1 AND stage='book'`,
      [eventId]
    )
    const bookedCount = regRows[0]?.count || 0

    // Decide stage
    const stage = bookedCount < event.min_attendees ? 'prebook' : 'book'

    // Prevent duplicate
    const { rows: existing } = await pool.query(
      `SELECT * FROM registrations WHERE event_id=$1 AND (user_id=$2 OR telegram_user_id=$3)`,
      [eventId, userId, telegramUserId]
    )
    if (existing.length > 0) return res.status(400).json({ error: 'Already registered' })

    let registration
    let clientSecret = null
    let ticketCode = crypto.randomBytes(8).toString('hex')

    // --------------------------
    // Free or Prebook
    // --------------------------
    if (event.price === 0 || stage === 'prebook') {
      const { rows } = await pool.query(
        `INSERT INTO registrations
         (event_id, user_id, telegram_user_id, stage, ticket_code, ticket_sent)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING *`,
        [eventId, userId, telegramUserId, stage, ticketCode, event.price === 0]
      )
      registration = rows[0]

      // Send ticket email immediately if free
      if (event.price === 0 && user.email) {
        await sendTicketEmail(user.email, event, { ...user, ticket_code: ticketCode })
      }

    } else {
      // --------------------------
      // Paid booking → Stripe
      // --------------------------
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(Number(event.price) * 100),
        currency: 'usd',
        metadata: { eventId, userId: userId ?? telegramUserId },
        receipt_email: user.email || undefined,
      })

      const { rows } = await pool.query(
        `INSERT INTO registrations
         (event_id, user_id, telegram_user_id, stage, ticket_code, stripe_payment_intent_id)
         VALUES ($1,$2,$3,'book',$4,$5)
         RETURNING *`,
        [eventId, userId, telegramUserId, ticketCode, paymentIntent.id]
      )
      registration = rows[0]
      clientSecret = paymentIntent.client_secret
    }

    return res.status(200).json({
      success: true,
      stage,
      registration,
      clientSecret,
    })

  } catch (err) {
    console.error('Error in /api/events/register:', err)
    return res.status(500).json({ error: 'Server error', details: err.message })
  }
}

