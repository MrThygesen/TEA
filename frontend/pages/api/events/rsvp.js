// pages/api/events/rsvp.js
import { auth } from '../../../lib/auth'
import pool from '../../../lib/db'

export default async function handler(req, res) {
  try {
    const token = auth.getTokenFromReq(req)
    if (!token) return res.status(401).json({ error: 'Unauthorized' })

    const decoded = auth.verifyToken(token)
    if (!decoded) return res.status(401).json({ error: 'Invalid token' })

    const userId = decoded.userId
    const { eventId } = req.body

    if (!eventId) {
      return res.status(400).json({ error: 'Missing eventId' })
    }

    if (req.method === 'POST') {
      // Add RSVP (insert favorite)
      await pool.query(
        `INSERT INTO favorites (user_id, event_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, event_id) DO NOTHING`,
        [userId, eventId]
      )
      return res.status(200).json({ success: true })
    }

    if (req.method === 'DELETE') {
      // Remove RSVP
      const result = await pool.query(
        `DELETE FROM favorites WHERE user_id = $1 AND event_id = $2 RETURNING *`,
        [userId, eventId]
      )

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'RSVP not found' })
      }

      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('❌ RSVP API error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
}

