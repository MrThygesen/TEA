// pages/api/events/favorites.js
import { pool } from '../../../lib/postgres.js'
import { auth } from '../../../lib/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' })

  const token = auth.getTokenFromReq(req)
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  let payload
  try {
    payload = auth.verifyToken(token)
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' })
  }

  const { eventId } = req.body || {}
  if (!eventId) return res.status(400).json({ error: 'Missing eventId' })

  try {
    // ✅ Toggle like/unlike
    const check = await pool.query(
      'SELECT 1 FROM hearts WHERE event_id = $1 AND user_id = $2',
      [eventId, payload.id]
    )

    if (check.rows.length > 0) {
      await pool.query('DELETE FROM hearts WHERE event_id = $1 AND user_id = $2', [eventId, payload.id])
    } else {
      await pool.query('INSERT INTO hearts (user_id, event_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [payload.id, eventId])
    }

    // ✅ Return updated like count
    const { rows } = await pool.query(
      'SELECT COUNT(*) AS count FROM hearts WHERE event_id = $1',
      [eventId]
    )

    res.status(200).json({ count: parseInt(rows[0].count, 10) })
  } catch (err) {
    console.error('favorites error:', err)
    res.status(500).json({ error: 'Database error', details: err.message })
  }
}

