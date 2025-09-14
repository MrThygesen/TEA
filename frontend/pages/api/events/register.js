// pages/api/events/register.js
import { pool } from '../../../lib/postgres.js'
import Stripe from 'stripe'
import { auth } from '../../../lib/auth.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' })
  }

  const token = auth.getTokenFromReq(req)
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  let user
  try {
    user = auth.verifyToken(token)
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' })
  }

  const { eventId } = req.body
  if (!eventId) {
    return res.status(400).json({ error: 'Missing eventId' })
  }

  try {
    // Fetch event
    const { rows } = await pool.query('SELECT * FROM events WHERE id=$1', [eventId])
    const event = rows[0]
    if (!event) {
      return res.status(404).json({ error: 'Event not found' })
    }

    // Insert registration (idempotent)
    await pool.query(
      `INSERT INTO registrations (event_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (event_id, user_id) DO NOTHING`,
      [eventId, user.id]
    )

    // If paid event → Stripe checkout
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

    // Free event → success
    return res.status(200).json({ message: 'Registered successfully' })
  } catch (err) {
    console.error('❌ register error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

