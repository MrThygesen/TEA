// pages/api/events/register.js
import { pool } from '../../../lib/postgres.js'
import { auth } from '../../../lib/auth.js'
import sendEmail from '../email.js'
import Stripe from 'stripe'
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = auth.getTokenFromReq(req)
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { userId } = auth.verifyToken(token)
  const { eventId, quantity = 1 } = req.body

  try {
    // Fetch event
    const eventRes = await pool.query('SELECT * FROM events WHERE id = $1', [eventId])
    if (!eventRes.rows.length) return res.status(404).json({ error: 'Event not found' })
    const event = eventRes.rows[0]

    const maxPerUser = event.tag1 === 'group' ? 5 : 1

    // Count existing tickets for this user
    const userTicketsRes = await pool.query(
      'SELECT COUNT(*) AS total FROM registrations WHERE event_id=$1 AND user_id=$2',
      [eventId, userId]
    )
    const currentTickets = parseInt(userTicketsRes.rows[0].total) || 0

    if (currentTickets + quantity > maxPerUser) {
      return res.status(400).json({ error: `Max ${maxPerUser} tickets per user` })
    }

    // Price & Stripe logic
    let clientSecret = null
    if (parseFloat(event.price) > 0) {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(parseFloat(event.price) * 100 * quantity), // convert to cents
        currency: 'usd',
        metadata: { eventId, userId },
      })
      clientSecret = paymentIntent.client_secret
    }

    // Insert one row per ticket
    const inserted = []
    for (let i = 0; i < quantity; i++) {
      const result = await pool.query(
        'INSERT INTO registrations (user_id, event_id, email) VALUES ($1, $2, $3) RETURNING *',
        [userId, eventId, req.body.email || null]
      )
      inserted.push(result.rows[0])
    }

    // Send email (free or paid)
    await sendEmail({
      to: req.body.email, // make sure frontend sends email in body
      subject: `Your Ticket for ${event.name}`,
      text: `You successfully registered ${quantity} ticket(s) for "${event.name}".`,
    })

    res.status(200).json({
      success: true,
      registrations: inserted,
      clientSecret,
      userTickets: currentTickets + quantity,
    })
  } catch (err) {
    console.error('❌ register.js error:', err)
    res.status(500).json({ error: 'Server error', details: err.message })
  }
}

