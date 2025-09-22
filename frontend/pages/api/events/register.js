// pages/api/events/register.js
import { pool } from '../../../lib/postgres.js'
import { auth } from '../../../lib/auth.js'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // --------------------------
    // Auth
    // --------------------------
    const token = auth.getTokenFromReq(req)
    if (!token) return res.status(401).json({ error: 'Unauthorized' })

    const decoded = auth.verifyToken(token) // <-- depends on your auth.js
    if (!decoded?.userId) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    // Fetch user from DB
    const { rows: users } = await pool.query(
      `SELECT id, email FROM user_profiles WHERE id = $1`,
      [decoded.userId]
    )
    if (users.length === 0) {
      return res.status(401).json({ error: 'User not found' })
    }
    const user = users[0]

    // --------------------------
    // Input
    // --------------------------
    const { eventId } = req.body
    if (!eventId) return res.status(400).json({ error: 'Missing eventId' })

    // Fetch event details
    const { rows: events } = await pool.query(
      `SELECT id, title, price, min_attendees, max_attendees
       FROM events 
       WHERE id = $1`,
      [eventId]
    )
    if (events.length === 0) return res.status(404).json({ error: 'Event not found' })

    const event = events[0]

    // Count current registrations
    const { rows: regRows } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM registrations WHERE event_id = $1`,
      [eventId]
    )
    const currentCount = regRows[0].count

    // Decide stage automatically
    const stage = currentCount < event.min_attendees ? 'prebook' : 'book'

    // Prevent duplicate registration
    const { rows: existing } = await pool.query(
      `SELECT id FROM registrations WHERE event_id = $1 AND user_id = $2`,
      [eventId, user.id]
    )
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Already registered' })
    }

    let registration
    let clientSecret = null

    // --------------------------
    // Handle Free / Prebook / Paid
    // --------------------------
    if (event.price === 0 || stage === 'prebook') {
      // Free OR Prebook → insert immediately
      const { rows } = await pool.query(
        `INSERT INTO registrations (event_id, user_id, stage, status)
         VALUES ($1, $2, $3, 'confirmed')
         RETURNING *`,
        [eventId, user.id, stage]
      )
      registration = rows[0]
    } else {
      // Paid booking (stage=book, price > 0) → Stripe
      const paymentIntent = await stripe.paymentIntents.create({
        amount: event.price,
        currency: 'usd',
        metadata: { eventId, userId: user.id },
      })

      const { rows } = await pool.query(
        `INSERT INTO registrations (event_id, user_id, stage, status, stripe_payment_intent_id)
         VALUES ($1, $2, 'book', 'pending', $3)
         RETURNING *`,
        [eventId, user.id, paymentIntent.id]
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
    res.status(500).json({ error: 'Server error' })
  }
}

