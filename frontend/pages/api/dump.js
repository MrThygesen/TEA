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
        e.details,
        e.venue,
        e.venue_type,                 
        e.min_attendees,
        e.max_attendees,
        e.basic_perk,
        e.advanced_perk,
        e.tag1,
        e.tag2,
        e.tag3,
        e.price,
        e.image_url,
        e.is_confirmed,               
        e.created_at,
        e.updated_at,
        -- counts
        COALESCE(COUNT(r.id), 0)::int AS registered_users,
        COALESCE(SUM(CASE WHEN r.has_paid = TRUE THEN 1 ELSE 0 END), 0)::int AS paid_count
      FROM events e
      LEFT JOIN registrations r 
        ON e.id = r.event_id
      WHERE e.datetime > NOW()
      GROUP BY e.id
      ORDER BY e.datetime ASC
      LIMIT 50
    `)

    res.status(200).json(result.rows)
  } catch (err) {
    console.error('❌ [API /dump] error:', err)
    res.status(500).json({ error: 'Database query failed', details: err.message })
  }
}

