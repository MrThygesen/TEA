// pages/api/login.js
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { pool } from '../../lib/postgres.js'

export const config = {
  api: {
    bodyParser: true, // ensure Next.js parses JSON
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' })
  }

  try {
    // 🛠 Handle both parsed object and raw string
    let body = req.body
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body)
      } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON body' })
      }
    }

    const { email, password } = body || {}
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' })
    }

    const result = await pool.query(
      `SELECT id, username, email, password_hash, role, tier, email_verified
       FROM user_profiles
       WHERE email = $1`,
      [email]
    )

    if (!result.rows.length) {
      return res.status(400).json({ error: 'Invalid email or password.' })
    }

    const user = result.rows[0]
    const validPassword = await bcrypt.compare(password, user.password_hash)

    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid email or password.' })
    }

    if (!user.email_verified) {
      return res.status(403).json({
        error: 'Email not verified. Please check your inbox and confirm your email before logging in.',
      })
    }

    // ✅ Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    return res.status(200).json({
      message: '✅ Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        tier: user.tier,
      },
    })
  } catch (err) {
    console.error('❌ Login error:', err)
    return res.status(500).json({ error: 'Internal server error', details: err.message })
  }
}

