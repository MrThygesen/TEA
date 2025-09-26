// pages/api/events/hearts.js
import { pool } from '../../../lib/postgres.js'

export default async function handler(req, res) {
  const { eventId } = req.query
  if (!eventId) return res.status(400).json({ error: 'Missing eventId' })

  try {
    const result = await pool.query(
      'SELECT COUNT(*) AS count FROM favorites WHERE event_id = $1',
      [eventId]
    )
    res.status(200).json({ count: parseInt(result.rows[0].count, 10) })
  } catch (err) {
    console.error('❌ /api/events/hearts error:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

