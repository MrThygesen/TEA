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
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Insert user (fail if email already exists)
    const result = await pool.query(
      `INSERT INTO user_profiles (email, password_hash, telegram_username, email_verified)
       VALUES ($1, $2, $3, FALSE)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email, telegram_username, role, tier`,
      [email, hashedPassword, username]
    )

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Email already registered' })
    }

    const user = result.rows[0]

    // Generate verification token
    const token = crypto.randomBytes(32).toString('hex')
    await pool.query(
      `INSERT INTO email_verification_tokens (user_id, token, expires_at, email)
       VALUES ($1, $2, NOW() + interval '1 day', $3)`,
      [user.id, token, email]
    )

    // Send verification email
    const verifyUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/confirm-email?token=${token}`
    await sendVerificationEmail(email, verifyUrl)

    return res.status(201).json({
      user,
      message: '✅ Registration successful. Please check your email to verify your account.',
    })
  } catch (err) {
    console.error('Registration error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

