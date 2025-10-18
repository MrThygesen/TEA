// pages/api/events/counters.js
import { sql, pool } from '../../../lib/postgres.js'

export default async function handler(req, res) {
  const { eventId } = req.query
  if (!eventId) return res.status(400).json({ error: 'Missing eventId' })

  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE stage = 'prebook') AS prebook_count,
        COUNT(*) FILTER (WHERE stage = 'book') AS book_count
      FROM registrations
      WHERE event_id = $1
    `, [eventId])

    const counts = result.rows[0] || { prebook_count: 0, book_count: 0 }
    res.json(counts)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

