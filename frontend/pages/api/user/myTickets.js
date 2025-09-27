import { pool } from '../../../lib/postgres.js'
import { auth } from '../../../lib/auth.js'

export default async function handler(req, res) {
  const token = auth.getTokenFromReq(req)
  if (!token) return res.status(401).json({ error: 'Not authenticated' })

  let user
  try {
    const decoded = auth.verifyToken(token)
    const { rows } = await pool.query(
      `SELECT id, username, email FROM user_profiles WHERE id=$1 LIMIT 1`,
      [decoded.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'User not found' })
    user = rows[0]
  } catch (err) {
    console.error('❌ myTickets error:', err)
    return res.status(500).json({ error: 'Server error', details: err.message })
  }

  try {
    const { rows: tickets } = await pool.query(`
      SELECT r.id AS registration_id,
             r.ticket_code,
             e.id AS event_id,
             e.name AS event_name,
             e.datetime,
             (SELECT COUNT(*) FROM registrations WHERE event_id = e.id) AS popularity
      FROM registrations r
      JOIN events e ON e.id = r.event_id
      WHERE r.user_id = $1
      ORDER BY e.datetime ASC
    `, [user.id])

    res.status(200).json({ user, tickets })
  } catch (err) {
    console.error('❌ myTickets error:', err)
    res.status(500).json({ error: 'Server error', details: err.message })
  }
}

