// pages/api/events/register.js
import { pool } from '../../../lib/postgres.js'
import { auth } from '../../../lib/auth.js'
import Stripe from 'stripe'
import crypto from 'crypto'
import { sendTicketEmail, sendPrebookEmail, sendUpgradeToBookEmail } from '../../../lib/email.js'

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
    } catch (err) {
      console.warn('Token verification failed:', err)
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
    // Input validation
    // --------------------------
    const { eventId, quantity = 1 } = req.body
    if (!eventId) return res.status(400).json({ error: 'Missing eventId' })
    if (quantity < 1) return res.status(400).json({ error: 'Quantity must be at least 1' })

    const { rows: eventRows } = await pool.query('SELECT * FROM events WHERE id=$1', [eventId])
    if (!eventRows.length) return res.status(404).json({ error: 'Event not found' })
    let event = eventRows[0]

    const price = Number(event.price) || 0
    const minAttendees = Number(event.min_attendees) || 0
    const maxAttendees = Number(event.max_attendees) || 40

    // --------------------------
    // Count existing registrations (overall)
    // --------------------------
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

    // --------------------------
    // Determine event stage
    // --------------------------
    let newStage = counters.prebook_count >= minAttendees ? 'book' : 'prebook'

    // Update event stage if changed
    if (event.is_confirmed !== (newStage === 'book')) {
      await pool.query(
        `UPDATE events SET is_confirmed=$1 WHERE id=$2`,
        [newStage === 'book', eventId]
      )
      event.is_confirmed = newStage === 'book'

      // Notify prebook users if event is now confirmed
      if (event.is_confirmed) {
        try {
          const { rows: prebookUsers } = await pool.query(
            `SELECT u.id, u.email, u.username, r.ticket_code
             FROM registrations r
             JOIN user_profiles u ON r.user_id = u.id
             WHERE r.event_id=$1 AND r.stage='prebook'`,
            [eventId]
          )
          for (const u of prebookUsers) {
            if (u.email) await sendUpgradeToBookEmail(u.email, event, { ...u })
          }
          console.log(`✅ Event ${eventId} confirmed, notified ${prebookUsers.length} prebook users`)
        } catch (err) {
          console.error('❌ Failed to notify prebook users:', err)
        }
      }
    }

    // --------------------------
    // Enforce per-user limit
    // --------------------------
    const maxPerUser = event.tag1 === 'group' ? 5 : 1
    const { rows: userCountRows } = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM registrations WHERE event_id=$1 AND user_id=$2`,
      [eventId, userId]
    )
    const userCount = userCountRows[0]?.cnt || 0
    if (userCount + quantity > maxPerUser) {
      return res.status(400).json({ error: 'Max tickets reached', counters })
    }

    // Enforce global max_attendees
    const totalRegistrations = counters.prebook_count + counters.book_count
    if (totalRegistrations + quantity > maxAttendees) {
      return res.status(400).json({ error: 'Event full', counters })
    }

    // --------------------------
    // Upgrade one existing prebook if stage is book
    // --------------------------
    if (newStage === 'book') {
      const { rows: prebookRows } = await pool.query(
        `SELECT * FROM registrations 
         WHERE event_id=$1 AND user_id=$2 AND stage='prebook' 
         ORDER BY timestamp ASC LIMIT 1`,
        [eventId, userId]
      )
      if (prebookRows.length > 0) {
        const existingReg = prebookRows[0]

        if (price > 0) {
          const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(price * 100),
            currency: 'usd',
            metadata: { eventId, userId },
            receipt_email: user.email || undefined,
          })

          const { rows } = await pool.query(
            `UPDATE registrations 
             SET stage='book', stripe_payment_intent_id=$1 
             WHERE id=$2 RETURNING *`,
            [paymentIntent.id, existingReg.id]
          )

          counters.prebook_count = Math.max(0, counters.prebook_count - 1)
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
            `UPDATE registrations SET stage='book' WHERE id=$1 RETURNING *`,
            [existingReg.id]
          )

          counters.prebook_count = Math.max(0, counters.prebook_count - 1)
          counters.book_count += 1

          if (user.email) {
            await sendTicketEmail(user.email, event, {
              ...user,
              ticket_code: existingReg.ticket_code,
            })
          }

          return res.status(200).json({
            success: true,
            stage: 'book',
            registration: rows[0],
            counters,
            clientSecret: null,
          })
        }
      }
    }

    // --------------------------
    // New registrations (loop quantity)
    // --------------------------
    const registrations = []
    let clientSecret = null

    for (let i = 0; i < quantity; i++) {
      const ticketCode = crypto.randomBytes(8).toString('hex')
      let reg

      if (newStage === 'prebook') {
        const { rows } = await pool.query(
          `INSERT INTO registrations (event_id, user_id, stage)
           VALUES ($1,$2,'prebook') RETURNING *`,
          [eventId, userId]
        )
        reg = rows[0]
        counters.prebook_count += 1

        if (user.email) {
          await sendPrebookEmail(user.email, event)
        }
      } else if (price === 0) {
        const { rows } = await pool.query(
          `INSERT INTO registrations (event_id, user_id, stage, ticket_code, ticket_sent)
           VALUES ($1,$2,'book',$3,TRUE) RETURNING *`,
          [eventId, userId, ticketCode]
        )
        reg = rows[0]
        counters.book_count += 1

        if (user.email) {
          await sendTicketEmail(user.email, event, { ...user, ticket_code: ticketCode })
        }
      } else {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(price * 100),
          currency: 'usd',
          metadata: { eventId, userId },
          receipt_email: user.email || undefined,
        })

        const { rows } = await pool.query(
          `INSERT INTO registrations (event_id, user_id, stage, ticket_code, stripe_payment_intent_id)
           VALUES ($1,$2,'book',$3,$4) RETURNING *`,
          [eventId, userId, ticketCode, paymentIntent.id]
        )
        reg = rows[0]
        counters.book_count += 1
        clientSecret = paymentIntent.client_secret
      }

      registrations.push(reg)
    }

    return res.status(200).json({
      success: true,
      stage: newStage,
      registrations,
      counters,
      clientSecret,
    })
  } catch (err) {
    console.error('Error in /api/events/register:', err)
    return res.status(500).json({ error: 'Server error', details: err.message })
  }
}

