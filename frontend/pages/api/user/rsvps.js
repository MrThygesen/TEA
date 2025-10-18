// pages/api/user/rsvps.js
import { sql, pool } from '../../../lib/postgres.js'
import { auth } from '../../../lib/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const token = auth.getTokenFromReq(req)
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  let payload
  try {
    payload = auth.verifyToken(token)
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' })
  }

  try {
    const rsvpResult = await pool.query(
      `
      SELECT 
        r.id AS rsvp_id,
        r.event_id,
        e.name AS title,
        e.datetime AS date,
        e.venue AS location,
        e.price,
        COALESCE(reg_count.count, 0) AS popularity
      FROM rsvps r
      JOIN events e ON e.id = r.event_id
      LEFT JOIN (
        SELECT event_id, COUNT(*) AS count
        FROM registrations
        WHERE has_paid = TRUE 
           OR event_id IN (SELECT id FROM events WHERE price IS NULL OR price = 0)
        GROUP BY event_id
      ) reg_count ON reg_count.event_id = e.id
      WHERE r.user_id = $1
      ORDER BY e.datetime DESC
      `,
      [payload.id]
    )

    res.status(200).json(rsvpResult.rows)
  } catch (err) {
    console.error('❌ rsvps.js error:', err)
    res.status(500).json({ error: 'Server error', details: err.message })
  }
}

