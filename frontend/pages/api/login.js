// pages/api/login.js
import bcrypt from 'bcryptjs' // keep same lib as before
import jwt from 'jsonwebtoken'
import { pool } from '../../lib/postgres.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' })

  try {
    const { email, username, password } = req.body
    if ((!email && !username) || !password) {
      return res.status(400).json({ error: 'Email or username and password are required' })
    }

    const identifier = email || username

    const result = await pool.query(
      `SELECT id, username, email, password_hash, role, tier, email_verified
       FROM user_profiles
       WHERE email = $1 OR username = $1
       LIMIT 1`,
      [identifier]
    )

    if (!result.rows.length) {
      return res.status(400).json({ error: 'Invalid credentials' })
    }

    const user = result.rows[0]
    const validPassword = await bcrypt.compare(password, user.password_hash)
    if (!validPassword) return res.status(400).json({ error: 'Invalid credentials' })

    if (!user.email_verified) {
      return res.status(403).json({ error: 'Email not verified' })
    }

    // ✅ keep old + add role in token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role || 'user',
      },
      process.env.JWT_SECRET || 'dev_secret',
      { expiresIn: '7d' }
    )

    return res.status(200).json({
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
    console.error('Login error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}


/*

///new login which is not working for my existing page.
// pages/api/login.js
import { pool } from '../../lib/postgres.js'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' })
  }

  try {
    const result = await pool.query(
      'SELECT * FROM user_profiles WHERE email = $1',
      [email]
    )

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const user = result.rows[0]
    const match = await bcrypt.compare(password, user.password_hash)
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // ✅ include role in JWT
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role || 'user',
      },
      process.env.JWT_SECRET || 'dev_secret',
      { expiresIn: '8h' }
    )

    res.status(200).json({ token })
  } catch (err) {
    console.error('[login] error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}


//api/login.js
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { pool } from '../../lib/postgres.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' })

  try {
    const { email, username, password } = req.body
    if ((!email && !username) || !password) {
      return res.status(400).json({ error: 'Email or username and password are required' })
    }

    const identifier = email || username

    const result = await pool.query(
      `SELECT id, username, email, password_hash, role, tier, email_verified
       FROM user_profiles
       WHERE email = $1 OR username = $1
       LIMIT 1`,
      [identifier]
    )

    if (!result.rows.length) {
      return res.status(400).json({ error: 'Invalid credentials' })
    }

    const user = result.rows[0]
    const validPassword = await bcrypt.compare(password, user.password_hash)
    if (!validPassword) return res.status(400).json({ error: 'Invalid credentials' })

    if (!user.email_verified) return res.status(403).json({ error: 'Email not verified' })

    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    return res.status(200).json({
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
    console.error('Login error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
*/
