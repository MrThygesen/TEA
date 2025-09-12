// pages/api/login.js
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { pool } from '../../lib/postgres.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' })
  }

  try {
    const { email, password } = req.body || {}
    console.log('📩 Login attempt with:', { email, password })

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' })
    }

    // Find user
    const result = await pool.query(
      `SELECT id, username, email, role, tier, password_hash, email_verified
       FROM user_profiles WHERE email = $1`,
      [email]
    )

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid email or password.' })
    }

    const user = result.rows[0]
    console.log('👤 Found user:', user.email, 'verified:', user.email_verified)

    // Verify password
    const passwordOk = await bcrypt.compare(password, user.password_hash)
    if (!passwordOk) {
      console.log('❌ Wrong password for:', email)
      return res.status(400).json({ error: 'Invalid email or password.' })
    }

    if (!user.email_verified) {
      return res.status(403).json({ error: 'Please verify your email first.' })
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username },
      process.env.JWT_SECRET || 'changeme',
      { expiresIn: '7d' }
    )

    console.log('✅ Login successful for:', email)

    res.status(200).json({
      message: 'Login successful',
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
    console.error('💥 Login error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

