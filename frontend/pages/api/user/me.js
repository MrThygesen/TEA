// pages/api/users/me.js
import { pool } from '../../../lib/postgres.js'
import { auth } from '../../../lib/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' })
  }

  const token = auth.getTokenFromReq(req)
  if (!token) return res.status(401).json({ error: 'Not authenticated' })

  let user
  try {
    user = auth.verifyToken(token)
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' })
  }

  try {
    // 1️⃣ Fetch user profile
    const { rows: userRows } = await pool.query(
      'SELECT id, username, email, tier FROM user_profiles WHERE id=$1',
      [user.id]
    )
    const profile = userRows[0]
    if (!profile) return res.status(404).json({ error: 'User not found' })

    // 2️⃣ Fetch paid coupons (paid registrations)
    const { rows: paidRows } = await pool.query(
      `SELECT r.id, e.name AS event_name, e.datetime AS event_datetime
       FROM registrations r
       JOIN events e ON r.event_id = e.id
       WHERE r.user_id=$1 AND r.is_paid = true`,
      [user.id]
    )

    // 3️⃣ Fetch prebooked events
    const { rows: prebookRows } = await pool.query(
      `SELECT p.id, e.name AS event_name, e.datetime AS event_datetime, e.min_attendees, COUNT(pr.id) >= e.min_attendees AS is_confirmed
       FROM prebookings p
       JOIN events e ON p.event_id = e.id
       LEFT JOIN prebookings pr ON pr.event_id = p.event_id
       WHERE p.user_id = $1
       GROUP BY p.id, e.name, e.datetime, e.min_attendees`,
      [user.id]
    )

    return res.status(200).json({
      id: profile.id,
      username: profile.username,
      email: profile.email,
      tier: profile.tier,
      paid_coupons: paidRows,
      prebooked_events: prebookRows,
    })
  } catch (err) {
    console.error('❌ /api/users/me error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
