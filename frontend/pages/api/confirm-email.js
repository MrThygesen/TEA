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
    // 1. Fetch the token data
    const result = await pool.query(
      `SELECT evt.user_id, evt.email, up.username
       FROM email_verification_tokens evt
       JOIN user_profiles up ON evt.user_id = up.id
       WHERE evt.token = $1
       LIMIT 1`,
      [token]
    )

    if (!result.rows.length) {
      return res.status(400).json({ error: 'Invalid or expired token.' })
    }

    const tokenData = result.rows[0]

    // 2. Mark user as verified
    await pool.query(
      `UPDATE user_profiles
       SET email_verified = TRUE
       WHERE id = $1`,
      [tokenData.user_id]
    )

    // 3. Remove the token to prevent reuse
    await pool.query(
      `DELETE FROM email_verification_tokens WHERE token = $1`,
      [token]
    )

    // 4. Generate JWT using the email from token table
    const jwtToken = jwt.sign(
      { id: tokenData.user_id, email: tokenData.email, username: tokenData.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    // 5. Return success and token
    return res.status(200).json({
      message: '✅ Email verified successfully',
      token: jwtToken,
      user: {
        id: tokenData.user_id,
        username: tokenData.username,
        email: tokenData.email,
      },
    })
  } catch (err) {
    console.error('❌ Email verification error:', err)
    return res.status(500).json({ error: 'Internal server error', details: err.message })
  }
}

