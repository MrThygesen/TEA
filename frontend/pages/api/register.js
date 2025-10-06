// pages/api/register.js
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { pool } from '../../lib/postgres.js'
import { sendVerificationEmail, sendTicketEmail } from '../../lib/email.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' })
  }

  const { email, password, username, eventId, ticketType } = req.body
  if (!email || !password || !username) {
    return res.status(400).json({ error: 'Username, email and password are required.' })
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10)

    const result = await pool.query(
      `INSERT INTO user_profiles (email, password_hash, username, email_verified)
       VALUES ($1, $2, $3, FALSE)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email, username, role, tier`,
      [email, hashedPassword, username]
    )

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Email already registered' })
    }

    const user = result.rows[0]

    // Verification token
    const token = crypto.randomBytes(32).toString('hex')
    await pool.query(
      `INSERT INTO email_verification_tokens (user_id, token, expires_at, email)
       VALUES ($1, $2, NOW() + interval '1 day', $3)
       ON CONFLICT (user_id) DO UPDATE SET token = EXCLUDED.token,
                                          expires_at = EXCLUDED.expires_at,
                                          email = EXCLUDED.email`,
      [user.id, token, email]
    )
    await sendVerificationEmail(email, token)

    // --- Free ticket handling
    if (ticketType === 'free' && eventId) {
      // Insert ticket immediately as booked
      const { rows: ticketRows } = await pool.query(
        `INSERT INTO registrations (event_id, user_id, email, stage, has_paid, ticket_code)
         VALUES ($1, $2, $3, 'book', FALSE, $4)
         RETURNING *`,
        [eventId, user.id, email, `ticket:${eventId}:${user.id}`]
      )
      const ticket = ticketRows[0]

      // Send ticket email
      const { rows: eventRows } = await pool.query('SELECT * FROM events WHERE id=$1', [eventId])
      if (eventRows.length) {
        await sendTicketEmail(email, eventRows[0], user, pool)
      }
    }

    return res.status(201).json({
      user,
      message:
        '✅ Registration successful. Please check your email to verify your account.',
    })
  } catch (err) {
    console.error('❌ User signup error:', err)
    return res.status(500).json({ error: 'Internal server error', details: err.message })
  }
}

