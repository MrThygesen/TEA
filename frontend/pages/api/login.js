// pages/api/login.js
import bcrypt from 'bcryptjs'
import { pool } from '../../lib/postgres.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { username, password } = req.body
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing username or password' })
  }

  try {
    const result = await pool.query(
      `SELECT telegram_user_id, telegram_username, email, password_hash, role
       FROM user_profiles
       WHERE telegram_username = $1`,
      [username]
    )

    const user = result.rows[0]
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

    return res.status(200).json({
      username: user.telegram_username,
      email: user.email,
      role: user.role,
    })
  } catch (err) {
    console.error('[API /login] Error:', err)
    return res.status(500).json({ error: 'Login failed', details: err.message })
  }
}

