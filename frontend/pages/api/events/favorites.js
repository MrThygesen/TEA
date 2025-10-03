// pages/api/events/favorites.js
import { pool } from '../../../lib/postgres.js'
import { auth } from '../../../lib/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' })

  const { eventId } = req.body
  if (!eventId) return res.status(400).json({ error: 'Missing eventId' })

  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) return res.status(401).json({ error: 'Unauthorized' })

    const user = auth.verifyToken(token)
    if (!user) return res.status(401).json({ error: 'Invalid token' })

    // Insert heart once per user
    await pool.query(
      `INSERT INTO favorites(event_id, user_id)
       VALUES($1, $2)
       ON CONFLICT (event_id, user_id) DO NOTHING`,
      [eventId, user.id]
    )

    // Get updated count
    const result = await pool.query(
      'SELECT COUNT(*)::int AS count FROM favorites WHERE event_id = $1',
      [eventId]
    )

    res.status(200).json({ count: result.rows[0].count })
  } catch (err) {
    console.error('❌ /api/events/favorite error:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

