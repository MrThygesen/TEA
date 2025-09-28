// pages/api/events/register.js
import { pool } from '../../../lib/postgres.js'
import { auth } from '../../../lib/auth.js'
import { sendTicketEmail } from '../../../lib/email.js'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const token = auth.getTokenFromReq(req)
  let decoded = null
  if (token) {
    try {
      decoded = auth.verifyToken(token)
    } catch {
      return res.status(401).json({ error: 'Invalid token' })
    }
  }

  const userId = decoded?.id || null
  const { eventId, quantity = 1, email } = req.body

  if (!userId && !email) {
    return res.status(400).json({ error: 'Must have user or email to register' })
  }

  try {
    // --- Fetch event
    const { rows: eventRows } = await pool.query(
      'SELECT * FROM events WHERE id = $1',
      [eventId]
    )
    if (!eventRows.length) return res.status(404).json({ error: 'Event not found' })
    const event = eventRows[0]

    const maxPerUser = event.tag1 === 'group' ? 5 : 1

    // --- Count existing tickets
    let currentTickets = 0
    if (userId) {
      const { rows } = await pool.query(
        'SELECT COUNT(*) AS total FROM registrations WHERE event_id=$1 AND user_id=$2',
        [eventId, userId]
      )
      currentTickets = parseInt(rows[0].total, 10) || 0
    }

    if (currentTickets + quantity > maxPerUser) {
      return res.status(400).json({ error: `Max ${maxPerUser} tickets per user` })
    }

    // --- Stripe logic
    let clientSecret = null
    const price = parseFloat(event.price) || 0
    if (price > 0) {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(price * 100 * quantity),
        currency: 'usd',
        metadata: { eventId, userId },
      })
      clientSecret = paymentIntent.client_secret
    }

    // --- Insert registrations with ticket_code
const inserted = []
for (let i = 0; i < quantity; i++) {
  // Generate unique ticket_code
  const ticket_code = `TICKET-${eventId}-${userId || 'guest'}-${Date.now()}-${i}`

  const { rows } = await pool.query(
    `INSERT INTO registrations (user_id, event_id, email, stage, has_paid, ticket_code)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [userId, eventId, email || null, price > 0 ? 'prebook' : 'book', price > 0, ticket_code]
  )
  inserted.push(rows[0])
}

// --- Send ticket email immediately if free event
if (price === 0 && user?.email) {
  try {
    await sendTicketEmail(user.email, event, user, pool)
    await pool.query(
      'UPDATE registrations SET ticket_sent = TRUE WHERE id = ANY($1::int[])',
      [inserted.map(r => r.id)]
    )
    console.log('✅ Ticket emails sent for free event')
  } catch (err) {
    console.error('❌ Failed to send ticket email (register.js):', err)
  }
}


      if (user?.email) {
        try {
          await sendTicketEmail(user.email, event, user)
          await pool.query(
            'UPDATE registrations SET ticket_sent = TRUE WHERE id = ANY($1::int[])',
            [inserted.map(r => r.id)]
          )
        } catch (err) {
          console.error('❌ Failed to send ticket email (register.js):', err)
        }
      }
    }

    return res.status(200).json({
      success: true,
      registrations: inserted,
      clientSecret,
      userTickets: currentTickets + quantity,
    })
  } catch (err) {
    console.error('❌ register.js error:', err)
    return res.status(500).json({ error: 'Server error', details: err.message })
  }
}

