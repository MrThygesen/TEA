// pages/api/confirm-email.js

import jwt from 'jsonwebtoken'
import { pool } from '../../lib/postgres.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' })
  }

  const { token } = req.query
  if (!token) {
    return res.status(400).json({ error: 'Missing verification token.' })
  }

  try {
    const q = `
      SELECT up.id AS user_id,
             up.username,
             up.email,
             evt.expires_at
      FROM email_verification_tokens evt
      JOIN user_profiles up ON up.id = evt.user_id
      WHERE evt.token = $1
      LIMIT 1
    `
    const result = await pool.query(q, [token])

    if (!result.rows.length) {
      return res.status(400).json({ error: 'Invalid or expired token.' })
    }

    const row = result.rows[0]
    const now = new Date()
    const expiresAt = new Date(row.expires_at)

    if (now.getTime() > expiresAt.getTime()) {
      return res.status(400).json({ error: 'Invalid or expired token.' })
    }

    // Mark email as verified
    await pool.query(
      `UPDATE user_profiles
       SET email_verified = TRUE
       WHERE id = $1`,
      [row.user_id]
    )

    // Remove token
    await pool.query(
      `DELETE FROM email_verification_tokens WHERE token = $1`,
      [token]
    )

    // Create JWT for auto-login
    const jwtToken = jwt.sign(
      { id: row.user_id, email: row.email, username: row.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    // Return JSON so frontend can handle auto-login
    return res.status(200).json({
      token: jwtToken,
      user: { id: row.user_id, email: row.email, username: row.username }
    })

  } catch (err) {
    console.error('❌ Email verification error:', err)
    return res.status(500).json({ error: 'Internal server error', details: err.message })
  }
}

