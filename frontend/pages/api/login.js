// pages/api/login.js
import bcrypt from 'bcryptjs'
import { pool } from '../../lib/postgres.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' })
  }

  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' })
  }

  try {
    // 1️⃣ Fetch user by email
    const result = await pool.query(
      `SELECT id, username, email, password_hash, role, tier, email_verified
       FROM user_profiles
       WHERE email = $1`,
      [email]
    )

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid email or password.' })
    }

    const user = result.rows[0]

    // 2️⃣ Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash)
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid email or password.' })
    }

    // 3️⃣ Check if email is verified
    if (!user.email_verified) {
      return res.status(403).json({
        error: 'Email not verified. Please check your inbox and confirm your email before logging in.',
      })
    }

    // 4️⃣ Login successful, return user data
    return res.status(200).json({
      message: '✅ Login successful',
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

