import { pool } from '../../../lib/postgres.js'
import { auth } from '../../../lib/auth.js'

export default async function handler(req, res) {
  const token = auth.getTokenFromReq(req)
  if (!token) return res.status(401).json({ error: 'Not authenticated' })

  let decoded
  try {
    decoded = auth.verifyToken(token)
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' })
  }

  const userId = decoded.id
  if (!userId) return res.status(400).json({ error: 'Invalid user' })

  try {
    const { rows } = await pool.query(
      `
      SELECT r.id, r.stage, r.ticket_code, e.name AS event_name
      FROM registrations r
      JOIN events e ON r.event_id = e.id
      WHERE r.user_id = $1
      ORDER BY r.timestamp DESC
      `,
      [userId]
    )

    const tickets = rows.map(r => ({
      id: r.id,
      event_name: r.event_name,
      stage: r.stage,
      ticket_code: r.ticket_code,
      qrData: r.ticket_code
        ? JSON.stringify({ code: r.ticket_code, event: r.event_name })
        : null
    }))

    res.json({ tickets })
  } catch (err) {
    console.error('Error in /api/user/myTickets:', err)
    res.status(500).json({ error: 'Server error', details: err.message })
  }
}

