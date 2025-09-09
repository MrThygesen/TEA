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

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' })
  }

  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Insert user (pure web, no telegram)
    const result = await pool.query(
      `INSERT INTO user_profiles (email, password_hash, telegram_user_id, telegram_username, email_verified)
       VALUES ($1, $2, NULL, NULL, FALSE)
       RETURNING id, email, role, tier`,
      [email, hashedPassword]
    )

    const user = result.rows[0]

    // Generate email verification token
    const token = crypto.randomBytes(32).toString('hex')
    await pool.query(
      `INSERT INTO email_verification_tokens (user_id, token, expires_at)
       VALUES ($1, $2, NOW() + interval '1 day')`,
      [user.id, token]
    )

    // Send verification email
    const verifyUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/verify-email?token=${token}`
    try {
      await sendVerificationEmail(email, verifyUrl)
    } catch (emailErr) {
      console.error('Failed to send verification email:', emailErr)
      return res.status(500).json({ error: 'Failed to send verification email' })
    }

    return res.status(201).json({
      user,
      message: 'Registration successful. Please check your email to verify your account.',
    })
  } catch (err) {
    // Handle duplicate email error
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Email already registered' })
    }
    console.error('Registration error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

