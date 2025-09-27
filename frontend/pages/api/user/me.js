// pages/api/user/me.js
import pkg from 'pg'
import { auth } from '../../../lib/auth'

const { Pool } = pkg

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const token = auth.getTokenFromReq(req)
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  let payload
  try {
    payload = auth.verifyToken(token)
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' })
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })

  try {
    // Load profile
    const profileResult = await pool.query(
      `SELECT id, username, email, tier, wallet_address, city, role
       FROM user_profiles
       WHERE id = $1`,
      [payload.id] // <-- FIXED: use payload.id
    )

    const profile = profileResult.rows[0]
    if (!profile) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Load registrations joined with events + popularity + price
    const regResult = await pool.query(
      `
      SELECT 
        r.id AS registration_id,
        r.event_id,
        r.stage,
        r.has_paid,
        r.ticket_code,
        r.timestamp,
        e.name AS event_name,
        e.datetime,
        e.price,
        COUNT(r2.id) AS popularity
      FROM registrations r
      JOIN events e ON e.id = r.event_id
      LEFT JOIN registrations r2 ON r2.event_id = e.id
      WHERE r.user_id = $1
      GROUP BY r.id, r.event_id, r.stage, r.has_paid, r.ticket_code, r.timestamp, e.name, e.datetime, e.price
      ORDER BY e.datetime DESC
      `,
      [payload.id] // <-- FIXED: use payload.id
    )

    res.status(200).json({
      ...profile,
      registrations: regResult.rows,
    })
  } catch (err) {
    console.error('❌ me.js error:', err)
    res.status(500).json({ error: 'Server error', details: err.message })
  } finally {
    await pool.end()
  }
}

