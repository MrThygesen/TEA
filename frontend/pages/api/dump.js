// pages/api/dump.js
import { pool } from '../../lib/postgres.js'

export default async function handler(req, res) {
  try {
    const result = await pool.query('SELECT * FROM events ORDER BY datetime DESC LIMIT 50')
    res.status(200).json(result.rows)
  } catch (err) {
    console.error('[API /dump]', err)
    res.status(500).json({ error: 'Database query failed', details: err.message })
  }
}



