import { auth } from '../../../lib/auth'
import { pool } from '../../../lib/postgres.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = auth.getTokenFromReq(req)
  const decoded = token ? auth.verifyToken(token) : null
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' })

  const { eventId } = req.body
  if (!eventId) return res.status(400).json({ error: 'Missing eventId' })

  try {
    // Insert once per user (duplicate likes ignored)
    await pool.query(
      `INSERT INTO favorites (event_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [eventId, decoded.id]
    )

    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS count FROM favorites WHERE event_id = $1',
      [eventId]
    )

    res.json({ count: rows[0]?.count || 0 })
  } catch (err) {
    console.error('Favorites error:', err)
    res.status(500).json({ error: 'Failed to save favorite' })
  }
}

