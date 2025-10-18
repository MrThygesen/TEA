// pages/api/dump.js
import { sql, pool } from '../../lib/postgres.js'

export default async function handler(req, res) {
  try {
    const result = await pool.query(`
      SELECT 
        e.id,
        e.admin_email,
        e.group_id,
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
        e.tag4,
        e.language,
        e.price,
        e.image_url,
        e.is_confirmed,
        e.approval_status,
        e.created_at,
        e.updated_at,
        e.approved_at,
        -- participant stats
        COALESCE(COUNT(r.id), 0)::int AS registered_users,
        COALESCE(SUM(CASE WHEN r.has_paid = TRUE THEN 1 ELSE 0 END), 0)::int AS paid_count
      FROM events e
      LEFT JOIN registrations r 
        ON e.id = r.event_id
      GROUP BY e.id
      ORDER BY 
        CASE 
          WHEN e.approval_status = 'pending' THEN 0
          WHEN e.approval_status = 'approved' THEN 1
          WHEN e.approval_status = 'rejected' THEN 2
          ELSE 3
        END,
        e.datetime ASC
      LIMIT 100
    `)

    res.status(200).json(result.rows)
  } catch (err) {
    console.error('❌ [API /dump] error:', err)
    res.status(500).json({
      error: 'Database query failed',
      details: err.message,
    })
  }
}

