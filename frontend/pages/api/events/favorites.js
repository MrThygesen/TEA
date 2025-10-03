import { pool } from '../../../lib/postgres.js'
import { auth } from '../../../lib/auth'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const token = req.headers.authorization?.split(' ')[1]
    const { eventId } = req.body
    if (!eventId) return res.status(400).json({ error: 'Missing eventId' })

    let userId = null
    let telegramUserId = null

    if (token) {
      const decoded = auth.verifyToken(token)
      if (decoded?.id) userId = decoded.id
      else if (decoded?.telegram_id) telegramUserId = decoded.telegram_id
    }

    if (!userId && !telegramUserId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // --- Insert or ignore ---
    if (userId) {
      await pool.query(
        `
        INSERT INTO favorites (event_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT ON CONSTRAINT favorites_event_user_unique DO NOTHING
      `,
        [eventId, userId]
      )
    } else if (telegramUserId) {
      await pool.query(
        `
        INSERT INTO favorites (event_id, telegram_user_id)
        VALUES ($1, $2)
        ON CONFLICT ON CONSTRAINT favorites_event_telegram_unique DO NOTHING
      `,
        [eventId, telegramUserId]
      )
    }

    // --- Count hearts for this event ---
    const result = await pool.query(
      `SELECT COUNT(*) FROM favorites WHERE event_id = $1`,
      [eventId]
    )

    res.status(200).json({ count: Number(result.rows[0].count) })
  } catch (err) {
    console.error('Favorites error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

