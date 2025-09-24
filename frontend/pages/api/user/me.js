// pages/api/user/me.js
import { pool } from '../../../lib/postgres.js'
import { auth } from '../../../lib/auth.js'

export default async function handler(req, res) {
  try {
    const token = auth.getTokenFromReq(req)
    if (!token) return res.status(401).json({ error: 'Not authenticated' })

    let decoded
    try {
      decoded = auth.verifyToken(token)
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    const userId = decoded.id
    if (!userId) return res.status(400).json({ error: 'No valid user in token' })

    // Fetch user profile
    const { rows: userRows } = await pool.query(
      'SELECT id, email, username FROM user_profiles WHERE id=$1',
      [userId]
    )
    if (!userRows.length) return res.status(404).json({ error: 'User not found' })
    const user = userRows[0]

    // Fetch all registrations with event details
    const { rows: registrations } = await pool.query(
      `SELECT r.id AS registration_id,
              r.stage AS original_stage,
              r.ticket_code,
              e.id AS event_id,
              e.name,
              e.datetime,
              e.min_attendees,
              e.max_attendees,
              e.price,
              e.tag1,
              e.is_confirmed
       FROM registrations r
       JOIN events e ON r.event_id = e.id
       WHERE r.user_id = $1
       ORDER BY e.datetime ASC`,
      [userId]
    )

    // Build dynamic response
    const enriched = []
    for (const r of registrations) {
      // Count all registrations for this event
      const { rows: countRows } = await pool.query(
        `SELECT stage, COUNT(*)::int AS count
         FROM registrations
         WHERE event_id=$1
         GROUP BY stage`,
        [r.event_id]
      )

      let prebook_count = 0
      let book_count = 0
      countRows.forEach(row => {
        if (row.stage === 'prebook') prebook_count = row.count
        if (row.stage === 'book') book_count = row.count
      })

      // Compute stage
      const stage = prebook_count < r.min_attendees ? 'prebook' : 'book'

      // Per-user ticket limits
      let maxPerUser = 1
      if (r.tag1 === 'group') {
        maxPerUser = 5
      }

      // Count user’s own tickets for this event
      const { rows: userTicketCount } = await pool.query(
        `SELECT COUNT(*)::int AS cnt
         FROM registrations
         WHERE event_id=$1 AND user_id=$2`,
        [r.event_id, userId]
      )

      enriched.push({
        registration_id: r.registration_id,
        event_id: r.event_id,
        event_name: r.name,
        event_datetime: r.datetime,
        ticket_code: r.ticket_code,
        stage,
        counters: { prebook_count, book_count },
        max_per_user: maxPerUser,
        user_tickets: userTicketCount[0]?.cnt || 0,
        price: r.price,
      })
    }

    return res.json({ user, registrations: enriched })
  } catch (err) {
    console.error('Error in /api/user/me:', err)
    return res.status(500).json({ error: 'Server error', details: err.message })
  }
}

