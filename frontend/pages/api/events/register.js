import { pool } from '../../../lib/postgres.js'
import { auth } from '../../../lib/auth.js'
import Stripe from 'stripe'
import crypto from 'crypto'
import { sendTicketEmail } from '../../../lib/email.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const token = auth.getTokenFromReq(req)
    if (!token) return res.status(401).json({ error: 'Not authenticated' })

    const decoded = auth.verifyToken(token)
    const userId = decoded?.id
    if (!userId) return res.status(400).json({ error: 'Invalid user' })

    const { eventId, quantity = 1 } = req.body
    if (!eventId) return res.status(400).json({ error: 'Missing eventId' })
    if (quantity < 1) return res.status(400).json({ error: 'Quantity must be >= 1' })

    // --- fetch event ---
    const { rows: eventRows } = await pool.query('SELECT * FROM events WHERE id=$1', [eventId])
    if (!eventRows.length) return res.status(404).json({ error: 'Event not found' })
    const event = eventRows[0]

    // --- fetch user profile (for email + username) ---
    const { rows: userRows } = await pool.query(
      'SELECT username, email FROM user_profiles WHERE id=$1',
      [userId]
    )
    if (!userRows.length) return res.status(404).json({ error: 'User not found' })
    const userProfile = userRows[0]

    // --- check hearts threshold ---
    const { rows: heartRows } = await pool.query(
      'SELECT COUNT(*)::int AS hearts FROM favorites WHERE event_id=$1',
      [eventId]
    )
    const hearts = heartRows[0]?.hearts || 0
    const unlocked = hearts >= 10
    if (!unlocked) return res.status(400).json({ error: 'Event not yet unlocked', hearts })

    // --- enforce per-user limit ---
    const maxPerUser = event.tag1 === 'group' ? 5 : 1
    const { rows: userCountRows } = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM registrations WHERE event_id=$1 AND user_id=$2',
      [eventId, userId]
    )
    const userCount = userCountRows[0]?.cnt || 0
    if (userCount + quantity > maxPerUser)
      return res.status(400).json({ error: 'Max tickets reached' })

    // --- enforce global max attendees ---
    const { rows: totalRows } = await pool.query(
      'SELECT COUNT(*)::int AS total FROM registrations WHERE event_id=$1',
      [eventId]
    )
    const totalRegistered = totalRows[0]?.total || 0
    if (totalRegistered + quantity > (event.max_attendees || 40))
      return res.status(400).json({ error: 'Event full' })

    // --- insert registrations ---
    const registrations = []
    let clientSecret = null
    const price = Number(event.price) || 0

    for (let i = 0; i < quantity; i++) {
      const ticketCode = crypto.randomBytes(8).toString('hex')

      if (price === 0) {
        const { rows } = await pool.query(
          `INSERT INTO registrations (event_id, user_id, stage, ticket_code, ticket_sent)
           VALUES ($1,$2,'book',$3,TRUE) RETURNING *`,
          [eventId, userId, ticketCode]
        )
        registrations.push(rows[0])

        // ✅ Always use DB email, not JWT
        if (userProfile.email) {
          await sendTicketEmail(userProfile.email, event, {
            username: userProfile.username,
            ticket_code: ticketCode,
          })
        }
      } else {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(price * 100),
          currency: 'usd',
          metadata: { eventId, userId },
          receipt_email: userProfile.email || undefined,
        })

        const { rows } = await pool.query(
          `INSERT INTO registrations (event_id, user_id, stage, ticket_code, stripe_payment_intent_id)
           VALUES ($1,$2,'book',$3,$4) RETURNING *`,
          [eventId, userId, ticketCode, paymentIntent.id]
        )
        registrations.push(rows[0])
        clientSecret = paymentIntent.client_secret
      }
    }

    return res.status(200).json({ success: true, registrations, clientSecret, hearts })
  } catch (err) {
    console.error('❌ /api/events/register:', err)
    return res.status(500).json({ error: 'Server error', details: err.message })
  }
}

