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
      // 🔹 GET: Fetch all or one event (optionally filter by approval)
      case 'GET': {
        if (query.id) {
          const id = parseIntOrFail(query.id, 'id')
          const result = await pool.query('SELECT * FROM events WHERE id = $1', [id])
          if (result.rows.length === 0)
            return res.status(404).json({ error: 'Event not found' })
          return res.status(200).json(result.rows[0])
        }

        // optional filters: ?approval=pending|approved
        let sql = 'SELECT * FROM events'
        const values = []
        if (query.approval) {
          sql += ' WHERE approval_status = $1'
          values.push(query.approval)
        }
        sql += ' ORDER BY id DESC'
        const result = await pool.query(sql, values)
        return res.status(200).json(result.rows)
      }

      // 🔹 POST: Client submits a new event (pending approval)
      case 'POST': {
        const {
          admin_email, // required
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
          group_id // optional
        } = body

        if (!name || !city || !datetime || !admin_email) {
          return res
            .status(400)
            .json({ error: 'Missing required fields (name, city, datetime, admin_email)' })
        }

        // 1️⃣ Ensure the submitting user exists
        let userRes = await pool.query('SELECT * FROM user_profiles WHERE email = $1', [admin_email])
        let user = userRes.rows[0]

        if (!user) {
          const newUser = await pool.query(
            'INSERT INTO user_profiles (email, role) VALUES ($1, $2) RETURNING *',
            [admin_email, 'user']
          )
          user = newUser.rows[0]
        }

        // 2️⃣ Insert event as pending
        const insertResult = await pool.query(
          `
          INSERT INTO events (
            admin_email, group_id,
            name, city, datetime,
            min_attendees, max_attendees,
            description, details, venue, venue_type,
            basic_perk, advanced_perk,
            tag1, tag2, tag3, tag4,
            language, price, image_url,
            approval_status, created_at, is_confirmed
          )
          VALUES (
            $1,$2,$3,$4,$5,
            $6,$7,
            $8,$9,$10,$11,
            $12,$13,
            $14,$15,$16,$17,
            $18,$19,$20,
            'pending', NOW(), false
          )
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

        // 3️⃣ Link creator to the event_organizers table
        await pool.query(
          `
          INSERT INTO event_organizers (event_id, user_id)
          VALUES ($1,$2)
          ON CONFLICT (event_id, user_id) DO NOTHING
          `,
          [newEventId, user.id]
        )

        const fullRow = await pool.query('SELECT * FROM events WHERE id = $1', [newEventId])
        return res.status(200).json(fullRow.rows[0])
      }

      // 🔹 PUT: Admin approves or rejects an event
      case 'PUT': {
        const { id, approval_status } = body
        if (!id || !['approved', 'rejected'].includes(approval_status)) {
          return res.status(400).json({
            error: 'Missing or invalid parameters (id, approval_status must be approved/rejected)',
          })
        }

        const eventRes = await pool.query('SELECT * FROM events WHERE id = $1', [id])
        if (eventRes.rows.length === 0) {
          return res.status(404).json({ error: 'Event not found' })
        }

        const event = eventRes.rows[0]
        const confirmed = approval_status === 'approved'

        await pool.query(
          `
          UPDATE events
          SET approval_status = $1,
              is_confirmed = $2,
              approved_at = CASE WHEN $1 = 'approved' THEN NOW() ELSE approved_at END
          WHERE id = $3
          `,
          [approval_status, confirmed, id]
        )

        const updated = await pool.query('SELECT * FROM events WHERE id = $1', [id])
        return res.status(200).json(updated.rows[0])
      }

      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT'])
        return res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (err) {
    console.error('❌ /api/events error:', err)
    return res.status(500).json({ error: err.message })
  }
}

