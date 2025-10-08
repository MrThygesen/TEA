// pages/api/events/favorites.js
import { pool } from '../../../lib/postgres.js'
import { getUserFromJWT } from '../../../lib/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' })

  try {
    const user = getUserFromJWT(req)
    const { eventId } = req.body || {}
    if (!eventId) return res.status(400).json({ error: 'Missing eventId' })
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

    // toggle favorite
    const check = await pool.query(
      'SELECT * FROM favorites WHERE event_id = $1 AND user_id = $2',
      [eventId, user.id]
    )

    if (check.rows.length > 0) {
      await pool.query('DELETE FROM favorites WHERE event_id = $1 AND user_id = $2', [eventId, user.id])
    } else {
      await pool.query(
        'INSERT INTO favorites (event_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [eventId, user.id]
      )
    }

    // return total count
    const { rows } = await pool.query('SELECT COUNT(*) AS count FROM favorites WHERE event_id = $1', [eventId])
    res.status(200).json({ count: parseInt(rows[0].count, 10) })
  } catch (err) {
    console.error('favorites.js error:', err)
    res.status(500).json({ error: 'Server error', details: err.message })
  }
}

