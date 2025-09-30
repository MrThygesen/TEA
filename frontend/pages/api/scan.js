// pages/api/scan.js
import { pool } from '../../lib/postgres'
import { auth } from '../../lib/auth'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' })

  try {
    // ✅ verify scanner staff login
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
      // fetch ticket & event
      const regRes = await client.query(`
        SELECT r.*, u.username, e.name AS event_name, e.basic_perk, e.advanced_perk
        FROM registrations r
        LEFT JOIN user_profiles u ON r.user_id = u.id
        LEFT JOIN events e ON r.event_id = e.id
        WHERE r.ticket_code = $1
      `, [ticket_code])

      if (!regRes.rows.length) {
        return res.status(404).json({ error: 'Ticket not found' })
      }

      const reg = regRes.rows[0]
      let message = ''

      // handle actions
      if (action === 'arrive') {
        if (reg.has_arrived) {
          message = 'Already applied for access'
        } else {
          await client.query(
            `UPDATE registrations SET has_arrived = TRUE, ticket_validated = TRUE, validated_by = $2, validated_at = NOW()
             WHERE id = $1`,
            [reg.id, decoded.username || decoded.email]
          )
          message = '✅ Access granted'
        }
      }

      if (action === 'perk') {
        if (reg.basic_perk_applied) {
          message = 'Perk already applied'
        } else {
          await client.query(
            `UPDATE registrations SET basic_perk_applied = TRUE WHERE id = $1`,
            [reg.id]
          )
          message = '✅ Perk applied'
        }
      }

      res.json({
        ticket_code,
        username: reg.username,
        event: reg.event_name,
        perks: {
          basic: reg.basic_perk,
          advanced: reg.advanced_perk
        },
        status: message
      })
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('Scan error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

