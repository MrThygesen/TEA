// pages/api/events.js
import { pool } from '../../lib/postgres.js'

export default async function handler(req, res) {
  const { method, body, query } = req

  try {
    // ======================
    // CREATE OR UPDATE EVENT (POST)
    // ======================
    if (method === 'POST') {
      const {
        id,
        name,
        city,
        datetime,
        min_attendees = 1,
        max_attendees = 40,
        is_confirmed = false,
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
        language = 'English',
        price = 0,
        image_url,
        group_id
      } = body

      if (!name || !city || !datetime) {
        return res.status(400).json({ error: 'Missing required fields: name, city, datetime' })
      }

      const { rows } = await pool.query(
        `
        INSERT INTO events (
          id, group_id, name, city, datetime,
          min_attendees, max_attendees, is_confirmed,
          description, details, venue, venue_type,
          basic_perk, advanced_perk,
          tag1, tag2, tag3, tag4, language,
          price, image_url
        ) VALUES (
          $1, COALESCE($2, $1), $3, $4, $5,
          $6, $7, $8,
          $9, $10, $11, $12,
          $13, $14,
          $15, $16, $17, $18, $19,
          $20, $21
        )
        ON CONFLICT (id)
        DO UPDATE SET
          group_id = COALESCE(EXCLUDED.group_id, events.id),
          name = EXCLUDED.name,
          city = EXCLUDED.city,
          datetime = EXCLUDED.datetime,
          min_attendees = EXCLUDED.min_attendees,
          max_attendees = EXCLUDED.max_attendees,
          is_confirmed = EXCLUDED.is_confirmed,
          description = EXCLUDED.description,
          details = EXCLUDED.details,
          venue = EXCLUDED.venue,
          venue_type = EXCLUDED.venue_type,
          basic_perk = EXCLUDED.basic_perk,
          advanced_perk = EXCLUDED.advanced_perk,
          tag1 = EXCLUDED.tag1,
          tag2 = EXCLUDED.tag2,
          tag3 = EXCLUDED.tag3,
          tag4 = EXCLUDED.tag4,
          language = EXCLUDED.language,
          price = EXCLUDED.price,
          image_url = EXCLUDED.image_url,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *;
        `,
        [
          id || null,
          group_id || null,
          name,
          city,
          new Date(datetime).toISOString(),
          min_attendees,
          max_attendees,
          is_confirmed,
          description || null,
          details || null,
          venue || null,
          venue_type || null,
          basic_perk || null,
          advanced_perk || null,
          tag1 || null,
          tag2 || null,
          tag3 || null,
          tag4 || null,
          language || 'English',
          price || 0,
          image_url || null
        ]
      )

      return res.status(200).json(rows[0])
    }

    // ======================
    // GET EVENTS
    // ======================
    if (method === 'GET') {
      const approvedOnly = query.approvedOnly === 'true'
      const upcomingOnly = query.upcomingOnly === 'true'

      let whereClauses = []
      if (approvedOnly) whereClauses.push('e.is_confirmed = TRUE')
      if (upcomingOnly) whereClauses.push('e.datetime > NOW()')

      const whereSQL = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : ''

      const result = await pool.query(`
        SELECT e.*, COUNT(r.id) AS registered_users
        FROM events e
        LEFT JOIN registrations r ON r.event_id = e.id
        ${whereSQL}
        GROUP BY e.id
        ORDER BY e.datetime ASC
      `)

      return res.status(200).json(result.rows)
    }

    res.setHeader('Allow', ['POST', 'GET'])
    return res.status(405).json({ error: `Method ${method} Not Allowed` })
  } catch (err) {
    console.error('❌ /api/events error:', err)
    res.status(500).json({ error: err.message })
  }
}

