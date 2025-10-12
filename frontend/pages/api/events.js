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
    admin_email, // <-- required
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

  if (!name || !city || !datetime || !admin_email) {
    return res.status(400).json({ error: 'Missing required fields (name, city, datetime, admin_email)' })
  }

  // 1️⃣ Find admin user
  const userRes = await pool.query('SELECT * FROM user_profiles WHERE email = $1', [admin_email])
  const user = userRes.rows[0]
  if (!user) return res.status(404).json({ error: 'Admin user not found' })

  // Optional: ensure user can be admin
  if (user.role !== 'user') return res.status(400).json({ error: 'User already has a role' })

  // 2️⃣ Insert event
  const insertResult = await pool.query(
    `
    INSERT INTO events (
      name, city, datetime,
      min_attendees, max_attendees, is_confirmed,
      description, details, venue, venue_type,
      basic_perk, advanced_perk,
      tag1, tag2, tag3, tag4,
      language, price, image_url
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
    RETURNING id
    `,
    [
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
    ]
  )

  const newEventId = insertResult.rows[0].id

  // 3️⃣ Assign admin to event
  await pool.query(
    'INSERT INTO event_organizers (event_id, user_id) VALUES ($1,$2)',
    [newEventId, user.id]
  )

  // 4️⃣ Update user role to admin
  await pool.query('UPDATE user_profiles SET role=$1 WHERE id=$2', ['admin', user.id])

  // 5️⃣ Set group_id = id
  await pool.query('UPDATE events SET group_id=$1 WHERE id=$1', [newEventId])

  const fullRow = await pool.query('SELECT * FROM events WHERE id=$1', [newEventId])
  return res.status(200).json(fullRow.rows[0])
}

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

