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
      // 🔹 GET: Fetch one or all events
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

      // 🔹 POST: Create a new event
      case 'POST': {
        const {
          admin_email, // required
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
          group_id // optional
        } = body

        if (!name || !city || !datetime || !admin_email) {
          return res.status(400).json({ error: 'Missing required fields (name, city, datetime, admin_email)' })
        }

        // 1️⃣ Find or create the admin user
        let userRes = await pool.query('SELECT * FROM user_profiles WHERE email = $1', [admin_email])
        let user = userRes.rows[0]

        if (!user) {
          // Create the user if missing
          const newUser = await pool.query(
            'INSERT INTO user_profiles (email, role) VALUES ($1, $2) RETURNING *',
            [admin_email, 'admin']
          )
          user = newUser.rows[0]
        } else if (!user.role || user.role === 'user') {
          // Promote user to admin if necessary
          await pool.query('UPDATE user_profiles SET role = $1 WHERE id = $2', ['admin', user.id])
        }

        // 2️⃣ Insert the event
        const insertResult = await pool.query(
          `
          INSERT INTO events (
            admin_email, group_id,
            name, city, datetime,
            min_attendees, max_attendees, is_confirmed,
            description, details, venue, venue_type,
            basic_perk, advanced_perk,
            tag1, tag2, tag3, tag4,
            language, price, image_url
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
          RETURNING id
          `,
          [
            admin_email,
            group_id || null,
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
            image_url || ''
          ]
        )

        const newEventId = insertResult.rows[0].id

        // 3️⃣ Assign admin as organizer (avoid duplicates)
        await pool.query(
          `
          INSERT INTO event_organizers (event_id, user_id)
          VALUES ($1,$2)
          ON CONFLICT (event_id, user_id) DO NOTHING
          `,
          [newEventId, user.id]
        )

        // ✅ Done
        const fullRow = await pool.query('SELECT * FROM events WHERE id = $1', [newEventId])
        return res.status(200).json(fullRow.rows[0])
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

