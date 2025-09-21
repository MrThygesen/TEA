import bcrypt from 'bcryptjs'
import { pool } from '../../lib/postgres.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' })

  const { email, username, password } = req.body
  if (!email || !username || !password) {
    return res.status(400).json({ error: 'Email, username, and password are required' })
  }

  try {
    // Hash password
    const hash = await bcrypt.hash(password, 10)

    const result = await pool.query(
      `INSERT INTO user_profiles (email, username, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, email, username, role, tier`,
      [email, username, hash]
    )

    return res.status(201).json({
      message: 'User created successfully',
      user: result.rows[0],
    })
  } catch (err) {
    console.error('Register error:', err)
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Email or username already exists' })
    }
    return res.status(500).json({ error: 'Internal server error', details: err.message })
  }
}

