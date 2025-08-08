// pages/api/dump.js
import { pool } from '../../lib/postgres'
export default async function handler(req, res) {
  try {
    // You can expand these queries to any table you need
    const events = await pool.query('SELECT * FROM events')
    const registrations = await pool.query('SELECT * FROM registrations')

    res.status(200).json({
      events: events.rows,
      registrations: registrations.rows
    })
  } catch (err) {
    console.error('❌ Error dumping DB:', err)
    res.status(500).json({ error: 'Failed to fetch database data' })
  }
}

