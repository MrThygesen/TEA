// pages/api/dump.js
import { pool } from '../../lib/postgres.js'

export default async function handler(req, res) {
  try {
    const result = await pool.query(`
      SELECT 
        e.id,
        e.name,
        e.city,
        e.datetime,
        e.description,
        e.venue,
        e.min_attendees,              -- added field
        e.max_attendees,              -- optional but good to include
        e.basic_perk,
        e.advanced_perk,
        e.tag1,
        e.tag2,
        e.tag3,
        e.price,
        e.image_url,
        COALESCE(COUNT(r.id), 0)::int AS registered_users,
        COALESCE(SUM(CASE WHEN r.has_paid = TRUE THEN 1 ELSE 0 END), 0)::int AS paid_count
      FROM events e
      LEFT JOIN registrations r 
        ON e.id = r.event_id
      WHERE e.datetime > NOW()
      GROUP BY 
        e.id, e.name, e.city, e.datetime, e.description, e.venue, 
        e.min_attendees, e.max_attendees,   -- added to group by
        e.basic_perk, e.advanced_perk, e.tag1, e.tag2, e.tag3, e.price, e.image_url
      ORDER BY e.datetime ASC
      LIMIT 50
    `)

    res.status(200).json(result.rows)
  } catch (err) {
    console.error('[API /dump]', err)
    res.status(500).json({ error: 'Database query failed', details: err.message })
  }
}

