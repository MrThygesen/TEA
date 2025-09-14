// pages/api/user/me.js
import { pool } from '../../../lib/postgres.js'
import { auth } from '../../../lib/auth.js'

export default async function handler(req, res) {
  const token = auth.getTokenFromReq(req)
  if (!token) return res.status(401).json({ error: 'Not authenticated' })

  let user
  try {
    user = auth.verifyToken(token)
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' })
  }

  try {
    // Fetch user info
    const { rows } = await pool.query(
      'SELECT id, username, email FROM users WHERE id=$1',
      [user.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'User not found' })
    const u = rows[0]

    // Fetch paid coupons
    const { rows: couponsRows } = await pool.query(
      `SELECT c.id, e.name AS event_name, e.datetime AS event_datetime
       FROM coupons c
       JOIN events e ON c.event_id = e.id
       WHERE c.user_id = $1 AND c.paid = true`,
      [user.id]
    )

    // Fetch prebooked events
    const { rows: prebookRows } = await pool.query(
      `SELECT r.id, e.name AS event_name, e.datetime AS event_datetime, e.is_confirmed AS is_confirmed
       FROM registrations r
       JOIN events e ON r.event_id = e.id
       WHERE r.user_id = $1`,
      [user.id]
    )

    return res.status(200).json({
      id: u.id,
      username: u.username,
      email: u.email,
      paid_coupons: couponsRows,
      prebooked_events: prebookRows,
    })
  } catch (err) {
    console.error('Error in /api/user/me:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

