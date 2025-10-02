// pages/api/scan.js
import { pool } from '../../lib/postgres'
import { auth } from '../../lib/auth'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const token = auth.getTokenFromReq(req)
      if (!token) return res.status(401).json({ error: 'Unauthorized' })
      const decoded = auth.verifyToken(token)
      if (!decoded || !['organizer', 'admin'].includes(decoded.role)) {
        return res.status(403).json({ error: 'Not allowed' })
      }

      // 🔹 Fetch events where this user is organizer OR (if admin) all events
      let eventsRes
      if (decoded.role === 'admin') {
        eventsRes = await pool.query(
          `SELECT * FROM events
           WHERE datetime >= NOW()
           AND datetime < NOW() + INTERVAL '2 days'
           ORDER BY datetime ASC`
        )
      } else {
        eventsRes = await pool.query(
          `SELECT e.* 
           FROM events e
           INNER JOIN event_organizers eo ON eo.event_id = e.id
           WHERE eo.user_id = $1
           AND e.datetime >= NOW()
           AND e.datetime < NOW() + INTERVAL '2 days'
           ORDER BY e.datetime ASC`,
          [decoded.id]
        )
      }

      if (!eventsRes.rows.length) {
        return res.json({ events: [], registrations: [] })
      }

      // Fetch all registrations for those events
      const eventIds = eventsRes.rows.map(e => e.id)
      const regRes = await pool.query(
        `SELECT r.*, u.username, u.email, e.name AS event_name, e.datetime,
                e.basic_perk, e.advanced_perk
         FROM registrations r
         LEFT JOIN user_profiles u ON r.user_id = u.id
         LEFT JOIN events e ON r.event_id = e.id
         WHERE r.event_id = ANY($1::int[])
         ORDER BY e.datetime, u.username`,
        [eventIds]
      )

      return res.json({
        events: eventsRes.rows,
        registrations: regRes.rows,
      })
    } catch (err) {
      console.error('Scan GET error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'POST') {
    try {
      const token = auth.getTokenFromReq(req)
      if (!token) return res.status(401).json({ error: 'Unauthorized' })
      const decoded = auth.verifyToken(token)
      if (!decoded || !['organizer', 'admin'].includes(decoded.role)) {
        return res.status(403).json({ error: 'Not allowed' })
      }

      const { ticket_code, action } = req.body
      if (!ticket_code) return res.status(400).json({ error: 'ticket_code required' })

      const client = await pool.connect()
      try {
        const regRes = await client.query(
          `SELECT r.*, u.username, u.email, e.name AS event_name, e.basic_perk, e.advanced_perk
           FROM registrations r
           LEFT JOIN user_profiles u ON r.user_id = u.id
           LEFT JOIN events e ON r.event_id = e.id
           WHERE r.ticket_code = $1`,
          [ticket_code]
        )

        if (!regRes.rows.length) {
          return res.status(404).json({ error: 'Ticket not found' })
        }

        const reg = regRes.rows[0]
        let message = ''

        if (action === 'arrive') {
          if (reg.has_arrived) {
            message = 'Already arrived'
          } else {
            await client.query(
              `UPDATE registrations
               SET has_arrived = TRUE, ticket_validated = TRUE,
                   validated_by = $2, validated_at = NOW()
               WHERE id = $1`,
              [reg.id, decoded.username || decoded.email]
            )
            message = '✅ Arrival confirmed'
          }
        }

        if (action === 'perk1') {
          if (reg.basic_perk_applied) {
            message = 'Perk1 already given'
          } else {
            await client.query(
              `UPDATE registrations SET basic_perk_applied = TRUE WHERE id = $1`,
              [reg.id]
            )
            message = '✅ Perk1 applied'
          }
        }

        if (action === 'perk2') {
          if (reg.advanced_perk_applied) {
            message = 'Perk2 already given'
          } else {
            await client.query(
              `UPDATE registrations SET advanced_perk_applied = TRUE WHERE id = $1`,
              [reg.id]
            )
            message = '✅ Perk2 applied'
          }
        }

        res.json({ ...reg, status: message })
      } finally {
        client.release()
      }
    } catch (err) {
      console.error('Scan POST error:', err)
      res.status(500).json({ error: 'Internal server error' })
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' })
  }
}

