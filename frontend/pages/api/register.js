import bcrypt from 'bcryptjs'
import { pool } from '../../lib/postgres.js'
import crypto from 'crypto'

export default async function handler(req, res) {
  if (req.method !== 'POST') 
    return res.status(405).json({ error: 'Method not allowed' })

  const { username, email, password, wallet_address, city } = req.body
  if (!username || !email || !password)
    return res.status(400).json({ error: 'Missing required fields' })

  try {
    // Check for existing user by username or email
    const existing = await pool.query(
      `SELECT user_id FROM user_profiles WHERE username = $1 OR email = $2`,
      [username, email]
    )
    if (existing.rows.length > 0)
      return res.status(409).json({ error: 'Username or email already exists' })

    // Hash password
    const password_hash = await bcrypt.hash(password, 10)
    const user_id = crypto.randomUUID()

    // Insert user
    await pool.query(
      `INSERT INTO user_profiles
       (user_id, username, email, password_hash, wallet_address, city)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [user_id, username, email, password_hash, wallet_address || null, city || 'Copenhagen']
    )

    // Generate verification token
    const token = crypto.randomBytes(32).toString('hex')
    const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h
    await pool.query(
      `INSERT INTO email_verification_tokens
       (user_id, email, token, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [user_id, email, token, expires_at]
    )

    // TODO: send email with verification link:
    // `${FRONTEND_URL}/verify-email?userId=${user_id}&token=${token}`

    return res.status(201).json({
      message: 'User registered successfully. Please check your email to verify your account.',
      user: { user_id, username, email }
    })
  } catch (err) {
    console.error('[API /register] Error:', err)
    return res.status(500).json({ error: 'Registration failed', details: err.message })
  }
}

