// pages/api/user/me.js
import { pool } from '../../../lib/postgres.js'
import { auth } from '../../../lib/auth.js'

export default async function handler(req, res) {
  const token = auth.getTokenFromReq(req)
  if (!token) return res.status(401).json({ error: 'Not authenticated' })

  let decoded
  try { decoded = auth.verifyToken(token) } 
  catch { return res.status(401).json({ error: 'Invalid token' }) }

  const userId = decoded?.id
  if (!userId) return res.status(400).json({ error: 'Invalid user' })

  try {
    const { rows: profileRows } = await pool.query(
      'SELECT id, username, email, wallet_address, city, role FROM user_profiles WHERE id=$1',
      [userId]
    )
    if (!profileRows.length) return res.status(404).json({ error: 'User not found' })
    const profile = profileRows[0]

    const { rows: regRows } = await pool.query(
      `SELECT r.event_id,
              e.name,
              e.tag1,
              COUNT(r.id)::int AS user_tickets,
              COALESCE(array_remove(array_agg(r.ticket_code), NULL), ARRAY[]::text[]) AS ticket_codes,
              (SELECT COUNT(*) FROM favorites f WHERE f.event_id=e.id) AS hearts
       FROM registrations r
       JOIN events e ON r.event_id = e.id
       WHERE r.user_id=$1
       GROUP BY r.event_id, e.name, e.tag1`,
      [userId]
    )

    const registrations = regRows.map(r => ({
      event_id: r.event_id,
      event_name: r.name,
      user_tickets: r.user_tickets,
      ticket_codes: r.ticket_codes,
      max_per_user: r.tag1 === 'group' ? 5 : 1,
      hearts: r.hearts,
      unlocked: r.hearts >= 10
    }))

    return res.json({ ...profile, registrations })
  } catch (err) {
    console.error('❌ /api/user/me:', err)
    return res.status(500).json({ error: 'Server error', details: err.message })
  }
}

