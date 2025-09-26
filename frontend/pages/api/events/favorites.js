// pages/api/events/favorite.js
import { pool } from '../../../lib/postgres.js'
import { auth } from '../../../lib/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { eventId } = req.body
  if (!eventId) return res.status(400).json({ error: 'Missing eventId' })

  let userId = null
  let telegramUserId = null

  const token = req.headers.authorization?.split(' ')[1]
  if (token) {
    try {
      const user = auth.verifyToken(token)  // make sure auth.js has verifyToken
      userId = user.id
    } catch (err) {
      console.warn('❌ Invalid token, proceeding as anonymous')
    }
  }

  try {
    // Only allow one heart per user per event
    if (userId) {
      await pool.query(
        `INSERT INTO favorites(event_id, user_id)
         VALUES($1, $2)
         ON CONFLICT(event_id, user_id) DO NOTHING`,
        [eventId, userId]
      )
    } else {
      // Anonymous user: create a generic favorite row with null user_id
      await pool.query(
        `INSERT INTO favorites(event_id, telegram_user_id)
         VALUES($1, $2)`,
        [eventId, null]
      )
    }

    // Return updated count
    const result = await pool.query(
      'SELECT COUNT(*) AS count FROM favorites WHERE event_id = $1',
      [eventId]
    )
    res.status(200).json({ count: parseInt(result.rows[0].count, 10) })
  } catch (err) {
    console.error('❌ /api/events/favorite error:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

