// pages/api/events/rsvps.js
import { pool } from '../../../lib/postgres.js'
import { getUserFromJWT } from '../../../lib/auth.js'

export default async function handler(req, res) {
  const { method } = req
  if (method !== 'POST' && method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const user = getUserFromJWT(req)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

    if (method === 'POST') {
      const { eventId } = req.body
      if (!eventId) return res.status(400).json({ error: 'Missing eventId' })

      await pool.query(
        'INSERT INTO rsvps (event_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [eventId, user.id]
      )

      return res.status(200).json({ success: true })
    }

    if (method === 'GET') {
      const { rows } = await pool.query(
        `SELECT e.* 
         FROM rsvps r 
         JOIN events e ON e.id = r.event_id 
         WHERE r.user_id = $1 
         ORDER BY e.datetime DESC`,
        [user.id]
      )
      return res.status(200).json(rows)
    }
  } catch (err) {
    console.error('rsvps.js error:', err)
    res.status(500).json({ error: 'Server error', details: err.message })
  }
}

