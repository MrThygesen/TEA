// pages/api/events/myRsvps.js
import { auth } from '../../../lib/auth'
import pool from '../../../lib/db'

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
      SELECT f.id as favorite_id, f.event_id, f.created_at, e.title, e.date, e.location
      FROM favorites f
      JOIN events e ON e.id = f.event_id
      WHERE f.user_id = $1
      ORDER BY f.created_at DESC
      `,
      [userId]
    )

    return res.status(200).json({ rsvps: rows })
  } catch (err) {
    console.error('Error fetching RSVPs', err)
    return res.status(500).json({ error: 'Server error' })
  }
}

