// pages/api/register.js
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { pool } from '../../lib/postgres.js'
import { sendVerificationEmail } from '../../lib/email.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' })
  }

  const { email, password, telegram_user_id, telegram_username } = req.body

  try {
    // --- If no email provided (pure Telegram registration) ---
    if (!email) {
      if (!telegram_user_id) {
        return res.status(400).json({ error: 'Telegram ID is required if no email is given.' })
      }

      const result = await pool.query(
        `INSERT INTO user_profiles (telegram_user_id, telegram_username)
         VALUES ($1, $2)
         ON CONFLICT (telegram_user_id) DO UPDATE
           SET telegram_username = EXCLUDED.telegram_username
         RETURNING id, telegram_user_id, telegram_username, role, tier, email, email_verified`,
        [telegram_user_id, telegram_username || null]
      )

      return res.status(201).json({
        user: result.rows[0],
        message: 'Telegram registration successful (no email provided).',
      })
    }

    // --- If email IS provided (Web OR Telegram with email) ---
    // Password may be empty if coming from Telegram edit
    let hashedPassword = null
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10)
    }

    const result = await pool.query(
      `INSERT INTO user_profiles (email, password_hash, telegram_user_id, telegram_username, email_verified)
       VALUES ($1, $2, $3, $4, FALSE)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email, role, tier`,
      [email, hashedPassword, telegram_user_id || null, telegram_username || null]
    )

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Email already registered' })
    }

    const user = result.rows[0]

    // Generate verification token
    const token = crypto.randomBytes(32).toString('hex')
    await pool.query(
      `INSERT INTO email_verification_tokens (user_id, token, expires_at)
       VALUES ($1, $2, NOW() + interval '1 day')`,
      [user.id, token]
    )

    const verifyUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/verify-email?token=${token}`
    await sendVerificationEmail(email, verifyUrl)

    return res.status(201).json({
      user,
      message: 'Registration successful. Please check your email to verify your account.',
    })
  } catch (err) {
    console.error('Registration error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

