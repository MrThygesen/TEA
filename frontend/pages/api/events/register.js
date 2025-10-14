// pages/api/events/register.js

import { pool } from '../../../lib/postgres.js'
import { auth } from '../../../lib/auth.js'
import { sendTicketEmail } from '../../../lib/email.js'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // --- Auth
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
    const { rows: eventRows } = await pool.query('SELECT * FROM events WHERE id=$1', [eventId])
    if (!eventRows.length) return res.status(404).json({ error: 'Event not found' })
    const event = eventRows[0]

// --- Gender-based seat balancing for "single-dinner-mix"
if (event.venue_type === 'single-dinner-mix') {
  // 1. Get user gender
  let gender = null
  if (userId) {
    const { rows: userRows } = await pool.query(
      'SELECT gender FROM user_profiles WHERE id=$1',
      [userId]
    )
    gender = userRows[0]?.gender
  }

  if (!gender) {
    return res.status(400).json({
      error: 'Gender not specified in your profile. Please update your profile before registering.',
    })
  }

  // 2. Count existing gender-based registrations
  const { rows: regRows } = await pool.query(
    `SELECT u.gender, COUNT(r.id) AS count
     FROM registrations r
     JOIN user_profiles u ON u.id = r.user_id
     WHERE r.event_id = $1
     GROUP BY u.gender`,
    [eventId]
  )

  const genderCounts = regRows.reduce(
    (acc, row) => ({ ...acc, [row.gender]: Number(row.count) }),
    { male: 0, female: 0 }
  )

  const totalAllowedPerGender = Math.floor(event.max_attendees / 2)

  // 3. Check limits
  if (gender === 'male' && genderCounts.male >= totalAllowedPerGender) {
    return res.status(400).json({
      error: `Sorry, all male seats are taken (${genderCounts.male}/${totalAllowedPerGender}).`,
    })
  }

  if (gender === 'female' && genderCounts.female >= totalAllowedPerGender) {
    return res.status(400).json({
      error: `Sorry, all female seats are taken (${genderCounts.female}/${totalAllowedPerGender}).`,
    })
  }

  console.log(`🧍 Gender seat check passed: ${gender} registered`)
}



    const maxPerUser = event.tag1 === 'group' ? 5 : 1

    // --- Check existing tickets
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

    const price = parseFloat(event.price) || 0
    let checkoutUrl = null

    // --- Stripe payment if price > 0
    if (price > 0) {
      console.log('💳 Creating Stripe session for paid event', {
        eventId,
        userId,
        email,
        quantity,
        price,
      })

      try {
        const session = await stripe.checkout.sessions.create({
          mode: 'payment',
          payment_method_types: ['card'],
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
          metadata: {
            eventId,
            userId: userId || 'guest',
            email: email || '',
            quantity,
          },
        })
        checkoutUrl = session.url
        console.log('✅ Stripe session created:', session.id, 'URL:', checkoutUrl)
      } catch (err) {
        console.error('❌ Stripe session creation failed:', err)
        return res.status(500).json({ error: 'Stripe session creation failed', details: err.message })
      }
    }

    // --- Insert all ticket placeholders
    const inserted = []
    for (let i = 0; i < quantity; i++) {
      const ticket_code = `TICKET-${eventId}-${userId || 'guest'}-${Date.now()}-${i}`
      const { rows } = await pool.query(
        `INSERT INTO registrations (user_id, event_id, email, stage, has_paid, ticket_code)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          userId,
          eventId,
          email || null,
          price > 0 ? 'prebook' : 'book',
          price === 0,
          ticket_code,
        ]
      )
      inserted.push(rows[0])
    }

    // --- Fetch user info for email
    let user = { id: userId, email }
    if (userId) {
      const { rows: userRows } = await pool.query(
        'SELECT id, username, email FROM user_profiles WHERE id=$1',
        [userId]
      )
      if (userRows.length) user = userRows[0]
    }

    // --- Send ticket emails immediately for free events
    if (price === 0 && user?.email) {
      try {
        await sendTicketEmail(user.email, event, user, pool)
        await pool.query(
          'UPDATE registrations SET ticket_sent = TRUE WHERE id = ANY($1::int[])',
          [inserted.map((r) => r.id)]
        )
        console.log('✅ Ticket emails sent for free event')
      } catch (err) {
        console.error('❌ Failed to send ticket email:', err)
      }
    }

    // --- Respond
    return res.status(200).json({
      success: true,
      registrations: inserted,
      checkoutUrl,
      userTickets: currentTickets + quantity,
    })
  } catch (err) {
    console.error('❌ register.js error:', err)
    return res.status(500).json({ error: 'Server error', details: err.message })
  }
}

