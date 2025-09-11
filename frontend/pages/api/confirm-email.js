// pages/api/confirm-email.js
import jwt from 'jsonwebtoken'
import { pool } from '../../lib/postgres.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' })
  }

  const { token, debug } = req.query
  if (!token) {
    return res.status(400).json({ error: 'Missing verification token.' })
  }

  try {
    // fetch token row + some DB timestamps and timezone for debugging
    const q = `
      SELECT up.id AS user_id,
             up.username,
             up.email,
             evt.expires_at,
             evt.created_at,
             NOW() AS db_now,
             current_setting('TimeZone') AS db_timezone
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

    // Node time
    const nodeNow = new Date()
    // expires_at may already be a JS Date (pg returns Date for timestamptz),
    // but to be safe convert to Date
    const expiresAt = row.expires_at ? new Date(row.expires_at) : null

    // Debug response (if requested)
    if (debug === '1') {
      return res.status(200).json({
        debug: {
          db_now: row.db_now,
          db_timezone: row.db_timezone,
          token_created_at: row.created_at,
          token_expires_at: expiresAt ? expiresAt.toISOString() : null,
          node_now: nodeNow.toISOString(),
          node_now_ms: nodeNow.getTime(),
          token_expires_ms: expiresAt ? expiresAt.getTime() : null,
          is_expired_according_to_node: expiresAt ? (nodeNow.getTime() > expiresAt.getTime()) : null
        }
      })
    }

    // check expiry according to Node clock
    if (!expiresAt || nodeNow.getTime() > expiresAt.getTime()) {
      return res.status(400).json({ error: 'Invalid or expired token.' })
    }

    // mark verified
    await pool.query(
      `UPDATE user_profiles
       SET email_verified = TRUE
       WHERE id = $1`,
      [row.user_id]
    )

    // remove token
    await pool.query(`DELETE FROM email_verification_tokens WHERE token = $1`, [token])

    // create JWT
    const jwtToken = jwt.sign(
      { id: row.user_id, email: row.email, username: row.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    return res.status(200).json({
      message: '✅ Email verified successfully',
      token: jwtToken,
      user: { id: row.user_id, username: row.username, email: row.email }
    })
  } catch (err) {
    console.error('❌ Email verification error:', err)
    return res.status(500).json({ error: 'Internal server error', details: err.message })
  }
}

