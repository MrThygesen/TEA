// pages/api/events.js
import { pool } from '../../../telegram-bot/postgres.js' // Adjust path if needed

export default async function handler(req, res) {
  const { method, query, body } = req

  if (method === 'POST') {
    const { typeId, name, datetime, minimum_attendees } = body
    if (!typeId || !name || !datetime || minimum_attendees == null) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    try {
      const result = await pool.query(
        `INSERT INTO events (id, name, datetime, minimum_attendees)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [typeId, name, datetime, minimum_attendees]
      )
      return res.status(201).json(result.rows[0])
    } catch (err) {
      console.error('[POST] Error inserting event:', err)
      return res.status(500).json({ error: 'Failed to insert event' })
    }
  }

  if (method === 'PUT') {
    const { typeId, name, datetime, minimum_attendees } = body
    if (!typeId || !name || !datetime || minimum_attendees == null) {
      return res.status(400).json({ error: 'Missing required fields for update' })
    }

    try {
      const result = await pool.query(
        `UPDATE events SET name = $2, datetime = $3, minimum_attendees = $4
         WHERE id = $1 RETURNING *`,
        [typeId, name, datetime, minimum_attendees]
      )

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Event not found for update' })
      }

      return res.status(200).json(result.rows[0])
    } catch (err) {
      console.error('[PUT] Error updating event:', err)
      return res.status(500).json({ error: 'Failed to update event' })
    }
  }

  if (method === 'GET') {
    try {
      const approvedOnly = query.approvedOnly === 'true'
      const result = await pool.query(
        approvedOnly
          ? 'SELECT * FROM events WHERE is_confirmed = TRUE ORDER BY datetime ASC'
          : 'SELECT * FROM events ORDER BY datetime ASC'
      )
      return res.status(200).json(result.rows)
    } catch (err) {
      console.error('[GET] Error fetching events:', err)
      return res.status(500).json({ error: 'Failed to fetch events' })
    }
  }

  return res.status(405).json({ error: `Method ${method} Not Allowed` })
}

