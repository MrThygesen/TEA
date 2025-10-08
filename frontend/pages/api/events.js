// pages/api/events.js
import { pool } from '../../lib/postgres.js'

export default async function handler(req, res) {
  const { method, body, query } = req

  const parseIntOrFail = (val, field) => {
    const num = Number(val)
    if (!Number.isInteger(num)) throw new Error(`${field} must be a valid integer`)
    return num
  }

  try {
    switch (method) {
      case 'GET': {
        if (query.id) {
          const id = parseIntOrFail(query.id, 'id')
          const result = await pool.query('SELECT * FROM events WHERE id = $1', [id])
          if (result.rows.length === 0) return res.status(404).json({ error: 'Event not found' })
          return res.status(200).json(result.rows[0])
        } else {
          const result = await pool.query('SELECT * FROM events ORDER BY id DESC')
          return res.status(200).json(result.rows)
        }
      }

      case 'POST': {
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

        if (!name || !city || !datetime) {
          return res.status(400).json({ error: 'Missing required fields (name, city, datetime)' })
        }

        const insertQuery = `
          INSERT INTO events (
            id, name, city, datetime,
            min_attendees, max_attendees, is_confirmed,
            description, details, venue, venue_type,
            basic_perk, advanced_perk,
            tag1, tag2, tag3, tag4, language,
            price, image_url
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $7,
            $8, $9, $10, $11,
            $12, $13,
            $14, $15, $16, $17, $18,
            $19, $20
          )
          ON CONFLICT (id) DO UPDATE SET
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
            image_url = EXCLUDED.image_url
          RETURNING *
        `

        const result = await pool.query(insertQuery, [
          Number(id),
          name,
          city,
          datetime,
          min_attendees ? Number(min_attendees) : null,
          max_attendees ? Number(max_attendees) : null,
          is_confirmed ?? false,
          description || '',
          details || '',
          venue || '',
          venue_type || '',
          basic_perk || '',
          advanced_perk || '',
          tag1 || '',
          tag2 || '',
          tag3 || '',
          tag4 || '',
          language || 'en',
          price ? Number(price) : 0,
          image_url || '',
        ])

        return res.status(200).json(result.rows[0])
      }

      default:
        res.setHeader('Allow', ['GET', 'POST'])
        return res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (err) {
    console.error('❌ /api/events error:', err)
    return res.status(500).json({ error: err.message })
  }
}

