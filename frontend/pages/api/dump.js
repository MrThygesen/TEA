// frontend/pages/api/dump.js
import { pool } from '../../lib/postgres.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    // Match what bot.js uses — includes more columns
    const result = await pool.query(`
      SELECT 
        id,
        name,
        datetime,
        min_attendees,
        max_attendees,
        is_confirmed,
        group_id,
        created_at
      FROM events
      ORDER BY datetime ASC
    `)

    return res.status(200).json(result.rows)
  } catch (err) {
    console.error('[API /dump] DB query failed:', err.message)
    return res.status(500).json({ error: 'Failed to fetch database dump', details: err.message })
  }
}

