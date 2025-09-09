// pages/api/login.js
import bcrypt from 'bcryptjs'
import { pool } from '../../lib/postgres.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' })
  }

  const { email, username, password } = req.body

  if ((!email && !username) || !password) {
    return res.status(400).json({ error: 'Email or username and password are required.' })
  }

  try {
    // Look up user either by email or by username
    const result = await pool.query(
      `SELECT id, email, telegram_username, password_hash, role, tier 
       FROM user_profiles 
       WHERE ($1::text IS NOT NULL AND email = $1) 
          OR ($2::text IS NOT NULL AND telegram_username = $2)`,
      [email || null, username || null]
    )

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid credentials' })
    }

    const user = result.rows[0]

    // Compare password
    const isValid = await bcrypt.compare(password, user.password_hash)
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid credentials' })
    }

    // Return safe user object (no password hash)
    return res.status(200).json({
      id: user.id,
      email: user.email,
      username: user.telegram_username,
      role: user.role,
      tier: user.tier,
    })
  } catch (err) {
    console.error('Login error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

