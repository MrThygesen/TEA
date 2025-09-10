// pages/api/confirm-email.js
const { pool } = require('../../lib/postgres.js')

module.exports = async function handler(req, res) {
  const { token } = req.query

  if (!token) {
    return res.redirect(302, 'https://teanet.xyz?status=error&reason=missing_token')
  }

  try {
    // Look up token
    const result = await pool.query(
      `SELECT user_id, expires_at FROM email_verification_tokens WHERE token = $1`,
      [token]
    )

    if (!result.rows.length) {
      return res.redirect(302, 'https://teanet.xyz?status=error&reason=invalid_token')
    }

    const { user_id, expires_at } = result.rows[0]

    // Check expiration
    if (new Date(expires_at) < new Date()) {
      return res.redirect(302, 'https://teanet.xyz?status=error&reason=expired_token')
    }

    // Update user as verified
    await pool.query(`UPDATE user_profiles SET email_verified = TRUE WHERE id = $1`, [
      user_id,
    ])

    // Delete token so it can’t be reused
    await pool.query(`DELETE FROM email_verification_tokens WHERE token = $1`, [token])

    console.log(`✅ Email verified for user_id ${user_id}`)
    return res.redirect(302, 'https://teanet.xyz?status=success')
  } catch (err) {
    console.error('❌ Email verification error:', err)
    return res.redirect(
      302,
      `https://teanet.xyz?status=error&reason=${encodeURIComponent(err.message)}`
    )
  }
}

