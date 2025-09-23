// pages/api/events/register.js
import { pool } from '../../../lib/postgres.js'
import { auth } from '../../../lib/auth.js'
import Stripe from 'stripe'
import crypto from 'crypto'
import { sendTicketEmail, sendPrebookEmail } from '../../../lib/email.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // --------------------------
    // Auth & User lookup
    // --------------------------
    const token = auth.getTokenFromReq(req)
    if (!token) return res.status(401).json({ error: 'Not authenticated' })

    let decoded
    try {
      decoded = auth.verifyToken(token)
    } catch {
      return res.status(401).json({ error: 'Invalid token' })
    }

    const userId = decoded.id
    if (!userId) return res.status(400).json({ error: 'No valid user in token' })

    const { rows: userRows } = await pool.query(
      'SELECT id, email, username FROM user_profiles WHERE id=$1',
      [userId]
    )
    if (!userRows.length) return res.status(404).json({ error: 'User not found' })
    const user = userRows[0]

    // --------------------------
    // Input
    // --------------------------
    const { eventId } = req.body
    if (!eventId) return res.status(400).json({ error: 'Missing eventId' })

    const { rows: events } = await pool.query(
      'SELECT * FROM events WHERE id=$1',
      [eventId]
    )
    if (!events.length) return res.status(404).json({ error: 'Event not found' })
    const event = events[0]

    const price = Number(event.price) || 0

    // Count existing registrations by stage
    const { rows: countRows } = await pool.query(
      `SELECT stage, COUNT(*)::int AS count 
       FROM registrations 
       WHERE event_id=$1 
       GROUP BY stage`,
      [eventId]
    )
    const counters = { prebook_count: 0, book_count: 0 }
    countRows.forEach(r => {
      if (r.stage === 'prebook') counters.prebook_count = r.count
      if (r.stage === 'book') counters.book_count = r.count
    })

    // Determine current stage
    let stage = counters.prebook_count >= event.min_attendees ? 'book' : 'prebook'

    // --------------------------
    // Check existing registration
    // --------------------------
    const { rows: existing } = await pool.query(
      `SELECT * FROM registrations WHERE event_id=$1 AND user_id=$2`,
      [eventId, userId]
    )

    if (existing.length > 0) {
      const existingReg = existing[0]

      if (existingReg.stage === 'book') {
        return res.status(400).json({ error: 'Already booked' })
      }

      if (stage === 'book' && existingReg.stage === 'prebook') {
        // Upgrade prebook → book
        if (price > 0) {
          const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(price * 100),
            currency: 'usd',
            metadata: { eventId, userId },
            receipt_email: user.email,
          })

          const { rows } = await pool.query(
            `UPDATE registrations
             SET stage='book', stripe_payment_intent_id=$1
             WHERE id=$2
             RETURNING *`,
            [paymentIntent.id, existingReg.id]
          )

          // Update counters
          counters.prebook_count -= 1
          counters.book_count += 1

          return res.status(200).json({
            success: true,
            stage: 'book',
            registration: rows[0],
            counters,
            clientSecret: paymentIntent.client_secret,
          })
        } else {
          const { rows } = await pool.query(
            `UPDATE registrations
             SET stage='book'
             WHERE id=$1
             RETURNING *`,
            [existingReg.id]
          )

          counters.prebook_count -= 1
          counters.book_count += 1

          // Send ticket email
          if (user.email) await sendTicketEmail(user.email, event, { ...user, ticket_code: existingReg.ticket_code })

          return res.status(200).json({
            success: true,
            stage: 'book',
            registration: rows[0],
            counters,
            clientSecret: null,
          })
        }
      }

      return res.status(400).json({ error: 'Already registered', counters })
    }

    // --------------------------
    // New registration
    // --------------------------
    const ticketCode = crypto.randomBytes(8).toString('hex')
    let registration
    let clientSecret = null

    if (stage === 'prebook' || price === 0) {
      // Prebook / free registration
      const { rows } = await pool.query(
        `INSERT INTO registrations
         (event_id, user_id, stage, ticket_code, ticket_sent)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING *`,
        [eventId, userId, stage, ticketCode, price === 0]
      )
      registration = rows[0]

      if (stage === 'prebook' && user.email) {
        await sendPrebookEmail(user.email, event)
      } else if (price === 0 && user.email) {
        await sendTicketEmail(user.email, event, { ...user, ticket_code: ticketCode })
      }

      counters[stage + '_count'] += 1
    } else {
      // Paid booking
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(price * 100),
        currency: 'usd',
        metadata: { eventId, userId },
        receipt_email: user.email,
      })

      const { rows } = await pool.query(
        `INSERT INTO registrations
         (event_id, user_id, stage, ticket_code, stripe_payment_intent_id)
         VALUES ($1,$2,'book',$3,$4)
         RETURNING *`,
        [eventId, userId, ticketCode, paymentIntent.id]
      )
      registration = rows[0]
      clientSecret = paymentIntent.client_secret

      counters.book_count += 1
    }

    return res.status(200).json({
      success: true,
      stage,
      registration,
      counters,
      clientSecret,
    })
  } catch (err) {
    console.error('Error in /api/events/register:', err)
    return res.status(500).json({ error: 'Server error', details: err.message })
  }
}

