// pages/api/register.js
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { pool } from '../../lib/postgres.js'
import { sendVerificationEmail } from '../../lib/email.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' })
  }

  const { email, password, username } = req.body
  if (!email || !password || !username) {
    return res.status(400).json({ error: 'Username, email and password are required.' })
  }

  try {
    console.log('🔹 Registration started for:', email)

    const hashedPassword = await bcrypt.hash(password, 10)

    const result = await pool.query(
      `INSERT INTO user_profiles (email, password_hash, username, email_verified)
       VALUES ($1, $2, $3, FALSE)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email, username`,
      [email, hashedPassword, username]
    )

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Email already registered' })
    }

    const user = result.rows[0]

    // ✅ Generate token
    const token = crypto.randomBytes(32).toString('hex')

    // ✅ Use ISO string for Postgres TIMESTAMPTZ
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    // Insert token
    await pool.query(
      `INSERT INTO email_verification_tokens (user_id, token, expires_at, email)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) 
       DO UPDATE SET token = EXCLUDED.token,
                     expires_at = EXCLUDED.expires_at,
                     email = EXCLUDED.email`,
      [user.id, token, expiresAt, email]
    )

    // Send verification email
    try {
      await sendVerificationEmail(email, token)
    } catch (emailErr) {
      console.warn('⚠️ Failed to send verification email:', emailErr)
    }

    return res.status(201).json({
      message: '✅ Registration successful. Please check your email to verify your account.',
      debug: { token, expiresAt }, // optional for debugging
    })

  } catch (err) {
    console.error('❌ Registration error:', err)
    return res.status(500).json({ error: 'Internal server error', details: err.message })
  }
}

