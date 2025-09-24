// pages/api/user/me.js
import { pool } from '../../../lib/postgres.js'
import { auth } from '../../../lib/auth.js'

export default async function handler(req, res) {
  const token = auth.getTokenFromReq(req)
  if (!token) return res.status(401).json({ error: 'Not authenticated' })

  let decoded
  try {
    decoded = auth.verifyToken(token)
  } catch (err) {
    console.warn('Token verification failed:', err)
    return res.status(401).json({ error: 'Invalid token' })
  }

  const userId = decoded.id
  if (!userId) return res.status(400).json({ error: 'Invalid user' })

  try {
    // -------------------
    // Fetch profile
    // -------------------
    const { rows: profileRows } = await pool.query(
      `SELECT id, username, email, wallet_address, city, role
       FROM user_profiles WHERE id=$1`,
      [userId]
    )
    if (!profileRows.length) return res.status(404).json({ error: 'User not found' })
    const profile = profileRows[0]

    // -------------------
    // Fetch registrations with counts
    // -------------------
    const { rows: regRows } = await pool.query(
      `
      SELECT r.event_id,
             e.name,
             e.tag1,
             COUNT(r.id)::int AS user_tickets
      FROM registrations r
      JOIN events e ON r.event_id = e.id
      WHERE r.user_id = $1
      GROUP BY r.event_id, e.name, e.tag1
      `,
      [userId]
    )

    const registrations = regRows.map(r => {
      const max_per_user = r.tag1 === 'group' ? 5 : 1
      return {
        event_id: r.event_id,
        event_name: r.name,
        user_tickets: r.user_tickets,
        max_per_user
      }
    })

    // -------------------
    // Response
    // -------------------
    return res.json({
      ...profile,
      registrations
    })
  } catch (err) {
    console.error('Error in /api/user/me:', err)
    return res.status(500).json({ error: 'Server error', details: err.message })
  }
}

