//events/rsvp.js
import { auth } from '../../../lib/auth'
import { pool } from '../../../lib/postgres.js'

export default async function handler(req, res) {
  try {
    const token = auth.getTokenFromReq(req)
    if (!token) return res.status(401).json({ error: 'Unauthorized' })

    const decoded = auth.verifyToken(token)
    if (!decoded) return res.status(401).json({ error: 'Invalid token' })

    const userId = decoded.id
    const { eventId } = req.body

    if (!eventId) return res.status(400).json({ error: 'Missing eventId' })

if (req.method === 'POST') {
  const result = await pool.query(
    `INSERT INTO rsvps (user_id, event_id)
     SELECT $1, $2
     WHERE NOT EXISTS (
       SELECT 1 FROM rsvps WHERE user_id = $1 AND event_id = $2
     )
     RETURNING *`,
    [userId, eventId]
  )

  return res.status(200).json({ success: true, rsvp: result.rows[0] })
}

    if (req.method === 'DELETE') {
      // Remove RSVP
      const result = await pool.query(
        `
        DELETE FROM rsvps
        WHERE user_id = $1 AND event_id = $2
        RETURNING *
        `,
        [userId, eventId]
      )

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'RSVPS not found' })
      }

      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('❌ RSVPS API error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
}

