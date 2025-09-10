// pages/api/confirm-email.js

import { pool } from '../../lib/postgres.js'

export default async function handler(req, res) {
  const { token } = req.query

  if (!token) {
    return res.redirect(
      302,
      `${process.env.NEXT_PUBLIC_BASE_URL}/email-verified?status=error&reason=missing_token`
    )
  }

  try {
    const result = await pool.query(
      `SELECT user_id, expires_at FROM email_verification_tokens WHERE token = $1`,
      [token]
    )

    if (result.rows.length === 0) {
      return res.redirect(
        302,
        `${process.env.NEXT_PUBLIC_BASE_URL}/email-verified?status=error&reason=invalid_token`
      )
    }

    const { user_id, expires_at } = result.rows[0]
    const now = new Date()

    if (new Date(expires_at) < now) {
      return res.redirect(
        302,
        `${process.env.NEXT_PUBLIC_BASE_URL}/email-verified?status=error&reason=expired_token`
      )
    }

    await pool.query(
      `UPDATE user_profiles SET email_verified = TRUE WHERE id = $1`,
      [user_id]
    )

    await pool.query(
      `DELETE FROM email_verification_tokens WHERE token = $1`,
      [token]
    )

    console.log(`✅ Email verified for user_id ${user_id}`)

    return res.redirect(
      302,
      `${process.env.NEXT_PUBLIC_BASE_URL}/email-verified?status=success`
    )

  } catch (err) {
    console.error('❌ Email verification error:', err)
    return res.redirect(
      302,
      `${process.env.NEXT_PUBLIC_BASE_URL}/email-verified?status=error&reason=${encodeURIComponent(err.message)}`
    )
  }
}

