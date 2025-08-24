// pages/api/dump.js
import { pool } from '../../lib/postgres.js'

export default async function handler(req, res) {
  const { user_id } = req.query // expecting ?user_id=... in request

  if (!user_id) {
    return res.status(400).json({ error: 'Missing user_id' })
  }

  try {
    // Check if user has 'organizer' role
    const roleCheck = await pool.query(
      'SELECT 1 FROM user_profiles WHERE user_id = $1 AND role = $2',
      [user_id, 'organizer']
    )

    if (roleCheck.rowCount === 0) {
      return res.status(403).json({ error: 'User is not an organizer' })
    }

    // Fetch events
    const result = await pool.query(`
      SELECT 
        e.id,
        e.name,
        e.city,
        e.datetime,
        e.description,
        e.venue,
        e.basic_perk,
        e.advanced_perk,
        e.tag1,
        e.tag2,
        e.tag3,
        e.image_url,
        COALESCE(COUNT(r.id), 0)::int AS registered_users
      FROM events e
      LEFT JOIN registrations r 
        ON e.id = r.event_id
      WHERE e.datetime > NOW()
      GROUP BY 
        e.id, e.name, e.city, e.datetime, e.description, e.venue, 
        e.basic_perk, e.advanced_perk, e.tag1, e.tag2, e.tag3, e.image_url
      ORDER BY e.datetime ASC
      LIMIT 50
    `)

    res.status(200).json(result.rows)
  } catch (err) {
    console.error('[API /dump]', err)
    res.status(500).json({ error: 'Database query failed', details: err.message })
  }
}

