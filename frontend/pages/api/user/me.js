// pages/api/user/me.js
import { pool } from '../../../lib/postgres.js'
import { auth } from '../../../lib/auth.js'

res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
res.setHeader('Pragma', 'no-cache')
res.setHeader('Expires', '0')
res.setHeader('Surrogate-Control', 'no-store')



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
    // Fetch user info (including password hash check)
    const { rows } = await pool.query(
      `SELECT id, username, email, role, wallet_address, city, tier,
              (password_hash IS NOT NULL) AS has_password
       FROM user_profiles
       WHERE id=$1`,
      [user.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'User not found' })
    const u = rows[0]

    // Fetch prebooked events
    const { rows: prebookRows } = await pool.query(
      `SELECT r.id AS registration_id,
              e.id AS event_id,
              e.name AS event_name,
              e.datetime AS event_datetime,
              e.is_confirmed AS is_confirmed,
              r.has_arrived,
              r.ticket_validated
       FROM registrations r
       JOIN events e ON r.event_id = e.id
       WHERE r.user_id = $1`,
      [user.id]
    )

    return res.status(200).json({
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      wallet_address: u.wallet_address,
      city: u.city,
      tier: u.tier,
      hasPassword: u.has_password,   // ✅ add this flag
      prebooked_events: prebookRows,
    })
  } catch (err) {
    console.error('Error in /api/user/me:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

