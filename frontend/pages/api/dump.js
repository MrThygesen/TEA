import { pool } from '../../lib/postgres.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    // Query events with extended info
    const eventsResult = await pool.query(`
      SELECT 
        id,
        name,
        datetime,
        min_attendees,
        max_attendees,
        is_confirmed,
        group_id,
        created_at
      FROM events
      ORDER BY datetime ASC
    `)

    // Also get invitation stats (optional)
    const invitesResult = await pool.query(`
      SELECT inviter_id, inviter_username, COUNT(*) AS confirmed_count
      FROM invitations
      WHERE confirmed = true
      GROUP BY inviter_id, inviter_username
    `)

    res.status(200).json({ events: eventsResult.rows, invite_stats: invitesResult.rows })
  } catch (err) {
    console.error('[API /dump] DB query failed:', err.message)
    res.status(500).json({ error: 'Failed to fetch database dump', details: err.message })
  }
}

