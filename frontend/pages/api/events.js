// pages/api/events.js
import { pool } from '../../lib/postgres.js';

export default async function handler(req, res) {
  const { method, body, query } = req;

  if (method === 'POST') {
    const {
      id,
      name,
      city,
      datetime,
      min_attendees,
      max_attendees,
      is_confirmed,
      description,
      details,
      venue,
      basic_perk,
      advanced_perk,
      tag1,
      tag2,
      tag3,
      image_url
    } = body;

    if (!id || !name || !city || !datetime) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      const result = await pool.query(
        `INSERT INTO events 
          (id, group_id, name, city, datetime, min_attendees, max_attendees, is_confirmed,
           description, details, venue, basic_perk, advanced_perk, tag1, tag2, tag3, image_url)
         VALUES 
          ($1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         RETURNING *`,
        [
          id,                // id ($1)
          name,              // name ($2)
          city,              // city ($3)
          datetime,          // datetime ($4)
          min_attendees || 1,
          max_attendees || 40,
          is_confirmed || false,
          description || null,
          details || null,
          venue || null,
          basic_perk || null,
          advanced_perk || null,
          tag1 || null,
          tag2 || null,
          tag3 || null,
          image_url || null
        ]
      );

      return res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('[POST] Error inserting event:', err);
      return res.status(500).json({ error: 'Failed to insert event', details: err.message });
    }
  }

  if (method === 'PUT') {
    const {
      id,
      name,
      city,
      datetime,
      min_attendees,
      max_attendees,
      is_confirmed,
      description,
      details,
      venue,
      basic_perk,
      advanced_perk,
      tag1,
      tag2,
      tag3,
      image_url
    } = body;

    if (!id || !name || !city || !datetime) {
      return res.status(400).json({ error: 'Missing required fields for update' });
    }

    try {
      const result = await pool.query(
        `UPDATE events
         SET group_id=$1, name=$2, city=$3, datetime=$4, min_attendees=$5, max_attendees=$6, is_confirmed=$7,
             description=$8, details=$9, venue=$10, basic_perk=$11, advanced_perk=$12,
             tag1=$13, tag2=$14, tag3=$15, image_url=$16, updated_at=NOW()
         WHERE id=$1
         RETURNING *`,
        [
          id, name, city, datetime,
          min_attendees || 1,
          max_attendees || 40,
          is_confirmed || false,
          description || null,
          details || null,
          venue || null,
          basic_perk || null,
          advanced_perk || null,
          tag1 || null,
          tag2 || null,
          tag3 || null,
          image_url || null
        ]
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
      return res.status(200).json(result.rows);
    } catch (err) {
      console.error('[GET] Error fetching events:', err);
      return res.status(500).json({ error: 'Failed to fetch events', details: err.message });
    }
  }

  return res.status(405).json({ error: `Method ${method} Not Allowed` });
}

