//pages/api/events/[id].js

import { pool } from '../../../lib/postgres.js'

export default async function handler(req, res) {
  const { id } = req.query
  if (!id) return res.status(400).json({ error: 'Missing id' })

  try {
    const { rows } = await pool.query('SELECT * FROM events WHERE id = $1', [id])
    if (rows.length === 0) return res.status(404).json({ error: 'Event not found' })
    res.status(200).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}
