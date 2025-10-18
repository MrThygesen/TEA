// pages/api/events/register.js
import Stripe from 'stripe'
import { pool } from '../../../lib/postgres.js'
import { auth } from '../../../lib/auth.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' })

  const token = auth.getTokenFromReq(req)
  if (!token) return res.status(401).json({ error: 'Not authorized' })

  let user
  try {
    user = auth.verifyToken(token)
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }

  const { eventId, quantity } = req.body
  if (!eventId || !quantity) return res.status(400).json({ error: 'Missing eventId or quantity' })

  try {
    const { rows } = await pool.query('SELECT * FROM events WHERE id=$1', [eventId])
    if (!rows.length) return res.status(404).json({ error: 'Event not found' })

    const event = rows[0]

    // 🎟 Hvis event er gratis → direkte registrering
    if (!event.price || Number(event.price) <= 0) {
      await pool.query(
        `INSERT INTO registrations (event_id, user_id, email, stage, has_paid, ticket_code)
         VALUES ($1, $2, $3, 'book', FALSE, $4)
         ON CONFLICT (event_id, user_id) DO NOTHING`,
        [eventId, user.id, user.email, `ticket:${eventId}:${user.id}:${Date.now()}`]
      )
      return res.json({ message: 'Free ticket booked.' })
    }

    // 💳 Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: event.name,
              description: `${event.city || ''}${event.venue ? ` · ${event.venue}` : ''}`,
            },
            unit_amount: Math.round(Number(event.price) * 100),
          },
          quantity,
        },
      ],
      metadata: {
        eventId: String(eventId),
        userId: String(user.id),
        quantity: String(quantity),
      },
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/event/${eventId}?cancel=true`,
    })

    return res.json({ checkoutUrl: session.url })
  } catch (err) {
    console.error('❌ register.js error:', err)
    res.status(500).json({ error: 'Server error', details: err.message })
  }
}

