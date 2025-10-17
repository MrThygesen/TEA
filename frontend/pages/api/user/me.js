// pages/api/user/me.js
import { auth } from '../../../lib/auth'
import { pool } from '../../../lib/postgres.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const token = auth.getTokenFromReq(req)
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  let payload
  try {
    payload = auth.verifyToken(token)
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }

  try {
    const profileResult = await pool.query(
      `SELECT id, username, email, tier, wallet_address, city, role
       FROM user_profiles
       WHERE id = $1`,
      [payload.id]
    )

    const profile = profileResult.rows[0]
    if (!profile) return res.status(404).json({ error: 'User not found' })

    const regResult = await pool.query(
      `
      SELECT 
        r.id AS id,
        r.event_id,
        r.ticket_code,
        r.stage,
        r.has_paid,
        r.timestamp,
        e.name AS event_title,
        e.datetime AS event_date,
        e.venue AS location,    
        e.price AS event_price,
        COALESCE(reg_count.count, 0) AS popularity
      FROM registrations r
      JOIN events e ON e.id = r.event_id
      LEFT JOIN (
        SELECT event_id, COUNT(*) AS count
        FROM registrations
        GROUP BY event_id
      ) reg_count ON reg_count.event_id = e.id
      WHERE r.user_id = $1
        AND (r.stage = 'book')
      ORDER BY e.datetime DESC
      `,
      [payload.id]
    )

    res.status(200).json({
      profile,
      tickets: regResult.rows,
    })
  } catch (err) {
    console.error('❌ me.js error:', err)
    res.status(500).json({ error: 'Server error', details: err.message })
  }
}

