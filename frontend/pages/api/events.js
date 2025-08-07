// pages/api/events.js
import { pool } from '../../lib/db'

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { typeId, name, datetime } = req.body
    if (!typeId || !name || !datetime) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    try {
      const result = await pool.query(
        'INSERT INTO events (id, name, datetime) VALUES ($1, $2, $3) RETURNING *',
        [typeId, name, datetime]
      )
      return res.status(201).json(result.rows[0])
    } catch (err) {
      console.error('Error inserting event:', err)
      return res.status(500).json({ error: 'Failed to insert event' })
    }
  }

  if (req.method === 'PUT') {
    const { typeId, name, datetime } = req.body
    if (!typeId || !name || !datetime) {
      return res.status(400).json({ error: 'Missing required fields for update' })
    }

    try {
      const result = await pool.query(
        'UPDATE events SET name = $2, datetime = $3 WHERE id = $1 RETURNING *',
        [typeId, name, datetime]
      )

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Event not found for update' })
      }

      return res.status(200).json(result.rows[0])
    } catch (err) {
      console.error('Error updating event:', err)
      return res.status(500).json({ error: 'Failed to update event' })
    }
  }

  if (req.method === 'GET') {
    const { approvedOnly } = req.query
    try {
      const query = approvedOnly === 'true'
        ? 'SELECT * FROM events WHERE is_confirmed = TRUE ORDER BY datetime ASC'
        : 'SELECT * FROM events WHERE is_confirmed = FALSE ORDER BY datetime ASC'

      const result = await pool.query(query)
      return res.status(200).json(result.rows)
    } catch (err) {
      console.error('Error fetching events:', err)
      return res.status(500).json({ error: 'Failed to fetch events' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

