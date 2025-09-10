// pages/api/confirm-email.js
import { pool } from '../../lib/postgres.js'

export default async function handler(req, res) {
  const { token } = req.query

  if (!token) {
    return res.redirect(
      302,
      'https://teanet.xyz?status=error&reason=missing_token'
    )
  }

  try {
    // 1. Look up token
    const result = await pool.query(
      `SELECT user_id, expires_at FROM email_verification_tokens WHERE token = $1`,
      [token]
    )

    if (result.rows.length === 0) {
      return res.redirect(
        302,
        'https://teanet.xyz?status=error&reason=invalid_token'
      )
    }

    const { user_id, expires_at } = result.rows[0]

    // 2. Check expiration
    if (new Date(expires_at) < new Date()) {
      return res.redirect(
        302,
        'https://teanet.xyz?status=error&reason=expired_token'
      )
    }

    // 3. Update user as verified
    await pool.query(
      `UPDATE user_profiles SET email_verified = TRUE WHERE id = $1`,
      [user_id]
    )

    // 4. Delete token so it can’t be reused
    await pool.query(
      `DELETE FROM email_verification_tokens WHERE token = $1`,
      [token]
    )

    console.log(`✅ Email verified for user_id ${user_id}`)

    // 5. Redirect success
    return res.redirect(302, 'https://teanet.xyz?status=success')
  } catch (err) {
    console.error('❌ Email verification error:', err)
    return res.redirect(
      302,
      `https://teanet.xyz?status=error&reason=${encodeURIComponent(
        err.message
      )}`
    )
  }
}

