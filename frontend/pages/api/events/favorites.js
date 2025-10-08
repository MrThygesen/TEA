import { pool } from '../../../lib/postgres.js'
import { getUserFromJWT } from '../../../lib/auth.js'

export default async function handler(req, res) {
  const user = getUserFromJWT(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { eventId } = req.body || {}
  if (!eventId) return res.status(400).json({ error: 'Missing eventId' })

  try {
    // Prevent duplicates — only one like per user per event
    await pool.query(`
      INSERT INTO hearts (user_id, event_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, event_id) DO NOTHING
    `, [user.id, eventId])

    // Return unique like count
    const { rows } = await pool.query(`
      SELECT COUNT(DISTINCT user_id) AS count
      FROM hearts
      WHERE event_id = $1
    `, [eventId])

    res.json({ count: parseInt(rows[0].count, 10) })
  } catch (err) {
    console.error('favorites error:', err)
    res.status(500).json({ error: 'Database error' })
  }
}

