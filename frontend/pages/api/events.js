// pages/api/events.js
import { pool } from '../../lib/postgres.js'

export default async function handler(req, res) {
  const { method, query, body } = req

  console.log(`[${method}] /api/events called with query:`, query)

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
      console.log(`[POST] Inserted event id=${typeId}`)
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
        console.warn(`[PUT] Event id=${typeId} not found`)
        return res.status(404).json({ error: 'Event not found for update' })
      }

      console.log(`[PUT] Updated event id=${typeId}`)
      return res.status(200).json(result.rows[0])
    } catch (err) {
      console.error('[PUT] Error updating event:', err)
      return res.status(500).json({ error: 'Failed to update event' })
    }
  }

  if (method === 'GET') {
    try {
      const approvedOnly = query.approvedOnly === 'true'
      // Explicitly select fields

