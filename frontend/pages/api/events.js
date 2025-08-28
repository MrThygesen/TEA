// pages/api/events.js
import { pool } from '../../lib/postgres.js'

export default async function handler(req, res) {
  const { method, body, query } = req

  const parseIntOrFail = (val, field) => {
    const num = Number(val)
    if (!Number.isInteger(num)) throw new Error(`${field} must be a valid number`)
    return num
  }

  try {
    // ======================
    // CREATE NEW EVENT (POST)
    // ======================
    if (method === 'POST') {
      const {
        name, city, datetime,
        min_attendees, max_attendees,
        is_confirmed, description, details,
        venue, venue_type,
        basic_perk, advanced_perk,
        tag1, tag2, tag3, price, image_url
      } = body

      if (!name || !city || !datetime) {
        return res.status(400).json({ error: 'Missing required fields: name, city, datetime' })
      }

      const client = await pool.connect()
      try {
        await client.query('BEGIN')

        // 1. Insert event
        const insertResult = await client.query(
          `INSERT INTO events
            (name, city, datetime, min_attendees, max_attendees, is_confirmed,
             description, details, venue, venue_type, basic_perk, advanced_perk,
             tag1, tag2, tag3, price, image_url)
           VALUES
            ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
           RETURNING id`,
          [
            name,
            city,
            new Date(datetime).toISOString(),
            min_attendees ?? 1,
            max_attendees ?? 40,
            is_confirmed ?? false,
            description || null,
            details || null,
            venue || null,
            venue_type || null,
            basic_perk || null,
            advanced_perk || null,
            tag1 || null,
            tag2 || null,
            tag3 || null,
            price || null,
            image_url || null
          ]
        )

        const newId = insertResult.rows[0].id

        // 2. Update group_id = id
        const updateResult = await client.query(
          `UPDATE events
           SET group_id = $1
           WHERE id = $1
           RETURNING *`,
          [newId]
        )

        await client.query('COMMIT')
        return res.status(201).json(updateResult.rows[0])
      } catch (err) {
        await client.query('ROLLBACK')
        console.error('[POST] Error inserting event:', err)
        return res.status(500).json({ error: 'Failed to insert event', details: err.message })
      } finally {
        client.release()
      }
    }

    // ======================
    // UPDATE EXISTING EVENT (PUT)
    // ======================
    if (method === 'PUT') {
      const {
        id, name, city, datetime,
        min_attendees, max_attendees,
        is_confirmed, description, details,
        venue, venue_type,
        basic_perk, advanced_perk,
        tag1, tag2, tag3, price, image_url
      } = body

      if (!id || !name || !city || !datetime) {
        return res.status(400).json({ error: 'Missing required fields for update' })
      }

      const group_id = parseIntOrFail(id, 'id')

      const result = await pool.query(
        `UPDATE events
         SET group_id=$1, name=$2, city=$3, datetime=$4,
             min_attendees=$5, max_attendees=$6, is_confirmed=$7,
             description=$8, details=$9, venue=$10, venue_type=$11,
             basic_perk=$12, advanced_perk=$13,
             tag1=$14, tag2=$15, tag3=$16,
             price=$17, image_url=$18,
             updated_at=NOW()
         WHERE id=$19
         RETURNING *`,
        [
          group_id,
          name,
          city,
          new Date(datetime).toISOString(),
          min_attendees ?? 1,
          max_attendees ?? 40,
          is_confirmed ?? false,
          description || null,
          details || null,
          venue || null,
          venue_type || null,
          basic_perk || null,
          advanced_perk || null,
          tag1 || null,
          tag2 || null,
          tag3 || null,
          price || null,
          image_url || null,
          id
        ]
      )

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Event not found for update' })
      }

      return res.status(200).json(result.rows[0])
    }

    // ======================
    // GET EVENTS (ALL or APPROVED)
    // ======================
    if (method === 'GET') {
      const approvedOnly = query.approvedOnly === 'true'

      const result = await pool.query(
        approvedOnly
          ? `
            SELECT e.*, COUNT(r.id) AS registered_users
            FROM events e
            LEFT JOIN registrations r ON r.event_id = e.id
            WHERE e.is_confirmed = TRUE
            GROUP BY e.id
            ORDER BY e.datetime ASC
          `
          : `
            SELECT e.*, COUNT(r.id) AS registered_users
            FROM events e
            LEFT JOIN registrations r ON r.event_id = e.id
            GROUP BY e.id
            ORDER BY e.datetime ASC
          `
      )

      return res.status(200).json(result.rows)
    }

    // ======================
    // METHOD NOT ALLOWED
    // ======================
    return res.status(405).json({ error: `Method ${method} Not Allowed` })
  } catch (err) {
    console.error('[Handler] Unexpected error:', err)
    return res.status(500).json({ error: 'Internal server error', details: err.message })
  }
}

