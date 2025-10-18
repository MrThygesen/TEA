// pages/api/events/hearts.js
import { sql, pool } from '../../../lib/postgres.js'

export default async function handler(req, res) {
  const { eventId } = req.query
  if (!eventId) return res.status(400).json({ error: 'Missing eventId' })

  try {
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS count FROM favorites WHERE event_id = $1',
      [eventId]
    )
    res.json({ count: rows[0]?.count || 0 })
  } catch (err) {
    console.error('Hearts fetch error:', err)
    res.status(500).json({ error: 'Failed to fetch hearts' })
  }
}

