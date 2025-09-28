//myRsvp.js 
import { auth } from '../../../lib/auth'
import { pool } from '../../../lib/postgres.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const token = auth.getTokenFromReq(req)
    if (!token) return res.status(401).json({ error: 'Unauthorized' })

    const decoded = auth.verifyToken(token)
    if (!decoded) return res.status(401).json({ error: 'Invalid token' })

    const userId = decoded.userId

    const { rows } = await pool.query(
      `
      SELECT f.id AS favorite_id,
             f.event_id,
             f.created_at,
             e.name AS title,
             e.city AS location,
             e.datetime AS date,
             e.price AS price
      FROM favorites f
      JOIN events e ON e.id = f.event_id
      WHERE f.user_id = $1
      ORDER BY f.created_at DESC
      `,
      [userId]
    )

    return res.status(200).json({ rsvps: rows })
  } catch (err) {
    console.error('❌ MyRSVPs API error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
}

