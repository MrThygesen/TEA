// frontend/pages/api/dump.js
import { pool } from '../../lib/postgres.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    const result = await pool.query('SELECT * FROM events ORDER BY datetime ASC')
    res.status(200).json(result.rows)
  } catch (err) {
    console.error('[GET] Error fetching database dump:', err)
    res.status(500).json({ error: 'Failed to fetch database dump' })
  }
}

