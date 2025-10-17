// pages/api/user/me.js
import { auth } from '../../../lib/auth'
import { pool } from '../../../lib/postgres.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const token = auth.getTokenFromReq(req)
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  let payload
  try {
    payload = auth.verifyToken(token)
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }

  try {
    // Fetch user profile
    const profileResult = await pool.query(
      `SELECT id, username, email, tier, wallet_address, city, role
       FROM user_profiles
       WHERE id = $1`,
      [payload.id]
    )

    const profile = profileResult.rows[0]
    if (!profile) return res.status(404).json({ error: 'User not found' })

    // Fetch events the user booked
    const regResult = await pool.query(
      `
      SELECT 
        r.id AS id,
        r.event_id,
        r.ticket_code,
        r.stage,
        r.has_paid,
        r.timestamp,
        e.name AS event_title,
        e.datetime AS event_date,
        e.venue AS location,
        e.price AS event_price,
        e.city,
        e.max_attendees,
        e.min_attendees,
        e.basic_perk,
        e.advanced_perk,
        e.tag1,
        e.tag2,
        e.tag3,
        e.tag4,
        e.venue_type,
        COALESCE(global_count.count, 0) AS popularity
      FROM registrations r
      JOIN events e ON e.id = r.event_id
      LEFT JOIN (
        SELECT event_id, COUNT(*) AS count
        FROM registrations
        WHERE stage = 'book'
        GROUP BY event_id
      ) global_count ON global_count.event_id = e.id
      WHERE r.user_id = $1
        AND r.stage = 'book'
      ORDER BY e.datetime DESC
      `,
      [payload.id]
    )

    // Fetch ALL events (for global popularity display)
    const allEventsResult = await pool.query(`
      SELECT
        e.id,
        e.name AS event_title,
        e.datetime AS event_date,
        e.city,
        e.venue AS location,
        e.price AS event_price,
        e.max_attendees,
        e.min_attendees,
        e.basic_perk,
        e.advanced_perk,
        e.tag1, e.tag2, e.tag3, e.tag4,
        e.venue_type,
        e.image_url,
        e.status,
        e.is_confirmed,
        COALESCE(global_count.count, 0) AS popularity
      FROM events e
      LEFT JOIN (
        SELECT event_id, COUNT(*) AS count
        FROM registrations
        WHERE stage = 'book'
        GROUP BY event_id
      ) global_count ON global_count.event_id = e.id
      ORDER BY e.datetime DESC
    `)

    res.status(200).json({
      profile,
      tickets: regResult.rows,
      allEvents: allEventsResult.rows,
    })
  } catch (err) {
    console.error('❌ me.js error:', err)
    res.status(500).json({ error: 'Server error', details: err.message })
  }
}

