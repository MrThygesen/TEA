//pages/api/events/register.js

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
    // Fetch event
    const { rows: eventRows } = await pool.query('SELECT * FROM events WHERE id=$1', [eventId])
    if (!eventRows.length) return res.status(404).json({ error: 'Event not found' })
    const event = eventRows[0]

    const maxPerUser = event.tag1 === 'group' ? 5 : 1

    // Count existing tickets
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

    // Insert registrations with unique ticket_codes
    const inserted = []
    for (let i = 0; i < quantity; i++) {
      const ticket_code = `TICKET-${eventId}-${userId || 'guest'}-${Date.now()}-${i}`
      const { rows } = await pool.query(
        `INSERT INTO registrations (user_id, event_id, email, has_paid, ticket_code, stage)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, ticket_sent`,
        [userId, eventId, email || null, event.price > 0 ? false : true, ticket_code, event.price > 0 ? 'prebook' : 'book']
      )
      inserted.push(rows[0])
    }

    // Free event: send ticket emails immediately
    if ((!event.price || Number(event.price) === 0) && (email || userId)) {
      let user = { id: userId, email }
      if (userId) {
        const { rows: userRows } = await pool.query('SELECT id, username, email FROM user_profiles WHERE id=$1', [userId])
        if (userRows.length) user = userRows[0]
      }

      try {
        for (const reg of inserted) {
          if (!reg.ticket_sent && user.email) {
            await sendTicketEmail(user.email, event, user, pool)
            await pool.query('UPDATE registrations SET ticket_sent = TRUE WHERE id=$1', [reg.id])
          }
        }
        console.log('✅ Ticket emails sent for free event')
      } catch (err) {
        console.error('❌ Failed to send ticket emails:', err)
      }
    }

    // Paid event: create Stripe Checkout session
    let clientSecret = null
    if (event.price && Number(event.price) > 0) {
      const metadata = {
        eventId: String(eventId),
        userId: userId ? String(userId) : '',
        email: email || '',
        ticketIds: inserted.map(r => r.id).join(',') // pass all ticket IDs
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(Number(event.price) * 100 * quantity),
        currency: 'usd',
        metadata,
      })
      clientSecret = paymentIntent.client_secret
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

