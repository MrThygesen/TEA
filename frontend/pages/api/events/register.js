//pages/api/events/register.js

import { pool } from '../../../lib/postgres.js'
import { auth } from '../../../lib/auth.js'
import { sendTicketEmail } from '../../../lib/email.js'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

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

  if (!eventId || quantity < 1) {
    return res.status(400).json({ error: 'Invalid request data' })
  }

  try {
    const { rows: eventRows } = await pool.query('SELECT * FROM events WHERE id=$1', [eventId])
    if (!eventRows.length) return res.status(404).json({ error: 'Event not found' })
    const event = eventRows[0]
    const price = parseFloat(event.price) || 0

    const maxPerUser = event.tag1 === 'group' ? 5 : 1

    // --- Limit check
    if (userId) {
      const { rows } = await pool.query(
        'SELECT COUNT(*) AS total FROM registrations WHERE event_id=$1 AND user_id=$2',
        [eventId, userId]
      )
      const existing = parseInt(rows[0].total, 10) || 0
      if (existing + quantity > maxPerUser) {
        return res.status(400).json({ error: `Max ${maxPerUser} tickets per user` })
      }
    }

    // --- Stripe for paid tickets
    let checkoutUrl = null
    if (price > 0) {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card', 'link'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: { name: event.name, description: event.description || '' },
              unit_amount: Math.round(price * 100),
            },
            quantity,
          },
        ],
        success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/event/${eventId}?success=true`,
        cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/event/${eventId}?canceled=true`,
        metadata: { eventId, userId: userId || 'guest', quantity },
      })
      checkoutUrl = session.url
    }

    // --- Insert ticket records
    const insertedIds = []
    for (let i = 0; i < quantity; i++) {
      const ticketCode = `T-${eventId}-${userId || 'guest'}-${Date.now()}-${i}`
      const { rows } = await pool.query(
        `INSERT INTO registrations (user_id, event_id, email, stage, has_paid, ticket_code)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [userId, eventId, email || null, price > 0 ? 'prebook' : 'book', price > 0 ? false : true, ticketCode]
      )
      insertedIds.push(rows[0].id)
    }

    // --- Email immediately if free
    if (price === 0) {
      const userEmail = email || (
        userId
          ? (await pool.query('SELECT email FROM user_profiles WHERE id=$1', [userId])).rows[0]?.email
          : null
      )

      if (userEmail) {
        for (const id of insertedIds) {
          await sendTicketEmail(userEmail, event, { id: userId, email: userEmail })
        }
        await pool.query('UPDATE registrations SET ticket_sent=TRUE WHERE id=ANY($1::int[])', [insertedIds])
      }
    }

    return res.status(200).json({
      success: true,
      checkoutUrl,
      ticketIds: insertedIds,
    })
  } catch (err) {
    console.error('❌ register.js error:', err)
    return res.status(500).json({ error: 'Server error', details: err.message })
  }
}

