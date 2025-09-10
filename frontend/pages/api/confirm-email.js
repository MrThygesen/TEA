// pages/api/confirm-email.js

import jwt from 'jsonwebtoken'
import { pool } from '../../lib/postgres.js'

console.log('JWT_SECRET in confirm-email:', process.env.JWT_SECRET)

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' })
  }

  const { token } = req.query
  if (!token) {
    return res.status(400).json({ error: 'Missing verification token.' })
  }

  try {
    // 1. Find the token in DB
    const result = await pool.query(
      `SELECT evt.user_id, up.username, up.email
       FROM email_verification_tokens evt
       JOIN user_profiles up ON evt.user_id = up.id
       WHERE evt.token = $1
       LIMIT 1`,
      [token]
    )

    if (!result.rows.length) {
      return res.status(400).json({ error: 'Invalid or expired token.' })
    }

    const user = result.rows[0]

    // 2. Mark user as verified
    await pool.query(
      `UPDATE user_profiles
       SET email_verified = TRUE
       WHERE id = $1`,
      [user.user_id]
    )

    // (Optional) Remove token so it can’t be reused
    await pool.query(`DELETE FROM email_verification_tokens WHERE token = $1`, [token])

    // 3. Create JWT
    const jwtToken = jwt.sign(
      { id: user.user_id, email: user.email, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    // 4. Send JWT back
    return res.status(200).json({
      message: '✅ Email verified successfully',
      token: jwtToken,
      user: {
        id: user.user_id,
        username: user.username,
        email: user.email,
      },
    })
  } catch (err) {
    console.error('❌ Email verification error:', err)
    return res.status(500).json({ error: 'Internal server error', details: err.message })
  }
}

