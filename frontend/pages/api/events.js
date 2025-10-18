// pages/api/events.js
import { sql, pool } from '../../lib/postgres.js'

export default async function handler(req, res) {
  const { method, body, query } = req

  try {
    if (method === 'GET') {
      // fetch all events
      const result = await pool.query('SELECT * FROM events ORDER BY datetime DESC')
      return res.status(200).json({ rows: result.rows })
    }

    if (method === 'POST') {
      // create a new event
      const {
        admin_email,
        group_id,
        name,
        city,
        datetime,
        min_attendees,
        max_attendees,
        description,
        details,
        venue,
        venue_type,
        basic_perk,
        advanced_perk,
        tag1,
        tag2,
        tag3,
        tag4,
        language,
        price,
        image_url,
      } = body

      if (!name || !city || !datetime || !admin_email) {
        return res.status(400).json({ error: 'Missing required fields: name, city, datetime, admin_email' })
      }

      const result = await pool.query(
        `INSERT INTO events
          (admin_email, group_id, name, city, datetime, min_attendees, max_attendees,
           description, details, venue, venue_type, basic_perk, advanced_perk,
           tag1, tag2, tag3, tag4, language, price, image_url, is_confirmed, is_rejected, status)
         VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,false,false,'pending')
         RETURNING *`,
        [
          admin_email, group_id || null, name, city, datetime, min_attendees || 1, max_attendees || 40,
          description || '', details || '', venue || '', venue_type || '', basic_perk || '', advanced_perk || '',
          tag1 || '', tag2 || '', tag3 || '', tag4 || '', language || 'en', price || 0, image_url || ''
        ]
      )

      return res.status(201).json({ rows: result.rows })
    }

    if (method === 'PUT') {
      // approve or reject event
      const { id, approval_status } = body
      if (!id || !approval_status) return res.status(400).json({ error: 'Missing id or approval_status' })
      if (!['approved', 'rejected'].includes(approval_status)) return res.status(400).json({ error: 'Invalid approval_status' })

      const is_confirmed = approval_status === 'approved'
      const is_rejected = approval_status === 'rejected'
      const status = approval_status

      const result = await pool.query(
        `UPDATE events
         SET is_confirmed=$1, is_rejected=$2, status=$3
         WHERE id=$4
         RETURNING *`,
        [is_confirmed, is_rejected, status, id]
      )

      if (!result.rows.length) return res.status(404).json({ error: 'Event not found' })
      return res.status(200).json({ rows: result.rows })
    }

    return res.status(405).json({ error: 'Method not allowed. Use GET, POST, or PUT.' })
  } catch (err) {
    console.error('events API error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

