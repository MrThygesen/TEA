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
    // 1. Lookup token and user
    const result = await pool.query(
      `SELECT up.id AS user_id, up.username, up.email
       FROM email_verification_tokens evt
       JOIN user_profiles up ON up.id = evt.user_id
       WHERE evt.token = $1
         AND evt.expires_at > NOW()
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

    // 3. Remove the token
    await pool.query(`DELETE FROM email_verification_tokens WHERE token = $1`, [token])

    // 4. Create JWT
    const jwtToken = jwt.sign(
      { id: user.user_id, email: user.email, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    // 5. Redirect to frontend page with token
    const redirectUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/email-verified?token=${jwtToken}&status=success`
    return res.redirect(302, redirectUrl)
  } catch (err) {
    console.error('❌ Email verification error:', err)
    return res.status(500).json({ error: 'Internal server error', details: err.message })
  }
}

