// frontend/pages/api/events.js
// frontend/pages/api/events.js
import { pool } from '../../lib/postgres.js'

export default async function handler(req, res) {
  const { method, query, body } = req;

  if (method === 'POST') {
    const { typeId, name, city, datetime, min_attendees } = body;
    if (!typeId || !name || !city || !datetime || min_attendees == null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      const result = await pool.query(
        `INSERT INTO events (id, name, city, datetime, min_attendees)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [typeId, name, city, datetime, min_attendees]
      );
      return res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('[POST] Error inserting event:', err);
      return res.status(500).json({ error: 'Failed to insert event', details: err.message });
    }
  }

  if (method === 'PUT') {
    const { typeId, name, city, datetime, min_attendees } = body;
    if (!typeId || !name || !city || !datetime || min_attendees == null) {
      return res.status(400).json({ error: 'Missing required fields for update' });
    }

    try {
      const result = await pool.query(
        `UPDATE events
         SET name = $2, city = $3, datetime = $4, min_attendees = $5
         WHERE id = $1
         RETURNING *`,
        [typeId, name, city, datetime, min_attendees]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Event not found for update' });
      }

      return res.status(200).json(result.rows[0]);
    } catch (err) {
      console.error('[PUT] Error updating event:', err);
      return res.status(500).json({ error: 'Failed to update event', details: err.message });
    }
  }

  if (method === 'GET') {
    try {
const approvedOnly = query.approvedOnly === 'true';
const result = await pool.query(
  approvedOnly
    ? 'SELECT * FROM events WHERE is_confirmed = TRUE ORDER BY datetime ASC'
    : 'SELECT * FROM events ORDER BY datetime ASC'
);
console.log('[GET] Events fetched:', result.rows);



      return res.status(200).json(result.rows);
    } catch (err) {
      console.error('[GET] Error fetching events:', err);
      return res.status(500).json({ error: 'Failed to fetch events', details: err.message });
    }
  }

  return res.status(405).json({ error: `Method ${method} Not Allowed` });
}

