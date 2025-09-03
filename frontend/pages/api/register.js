// pages/api/register.js
import bcrypt from 'bcryptjs'
import { pool } from '../../lib/postgres.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { username, email, password, wallet_address, city } = req.body

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    // Check if username or email already exists
    const existing = await pool.query(
      `SELECT telegram_user_id FROM user_profiles WHERE telegram_username = $1 OR email = $2`,
      [username, email]
    )
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Username or email already exists' })
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10)

    // Insert user into database
    const result = await pool.query(
      `INSERT INTO user_profiles
       (telegram_user_id, telegram_username, email, password_hash, wallet_address, city)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING telegram_user_id, telegram_username, email, role`,
      [
        `tg_${Date.now()}`, // simple unique telegram_user_id placeholder
        username,
        email,
        password_hash,
        wallet_address || null,
        city || 'Copenhagen'
      ]
    )

    const user = result.rows[0]

    return res.status(201).json({
      message: 'User registered successfully',
      user
    })
  } catch (err) {
    console.error('[API /register] Error:', err)
    return res.status(500).json({ error: 'Registration failed', details: err.message })
  }
}

