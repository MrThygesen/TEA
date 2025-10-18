// pages/api/user/metrics.js
import jwt from 'jsonwebtoken'
import { sql, pool } from '../../../lib/postgres.js'

const TOKEN_KEY = process.env.JWT_SECRET || 'dev_secret'

export default async function handler(req, res) {
  const authHeader = req.headers.authorization
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing authorization header' })
  }

  const [, token] = authHeader.split(' ')
  let userId
  try {
    const decoded = jwt.verify(token, TOKEN_KEY)
    userId = decoded.id
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' })
  }

  try {
    const [rsvpCount, ticketCount, arrivedCount, favoritesCount] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM rsvps WHERE user_id = $1`, [userId]),
      pool.query(
        `SELECT COUNT(*) 
         FROM registrations r
         JOIN events e ON e.id = r.event_id
         WHERE r.user_id = $1
           AND (
             r.has_paid = TRUE
             OR (r.has_paid = FALSE AND (e.price IS NULL OR e.price = 0))
           )`,
        [userId]
      ),
      pool.query(`SELECT COUNT(*) FROM registrations WHERE user_id = $1 AND has_arrived = TRUE`, [userId]),
      pool.query(`SELECT COUNT(*) FROM favorites WHERE user_id = $1`, [userId]),
    ])

    const rsvps = parseInt(rsvpCount.rows[0].count || 0)
    const ticketsBought = parseInt(ticketCount.rows[0].count || 0)
    const arrivals = parseInt(arrivedCount.rows[0].count || 0)
    const favorites = parseInt(favoritesCount.rows[0].count || 0)

    const showUpRate = ticketsBought > 0 ? Math.round((arrivals / ticketsBought) * 100) : 0
    const points = arrivals
    const freeRewards = Math.floor(points / 9)
    const pointsTowardNextFree = points % 9

    res.status(200).json({
      tickets_bought: ticketsBought,
      rsvp_count: rsvps,
      favorites,
      show_up_rate: showUpRate,
      points,
      free_rewards: freeRewards,
      points_toward_next_free: pointsTowardNextFree,
    })
  } catch (err) {
    console.error('❌ metrics.js error:', err)
    res.status(500).json({ error: 'Server error', details: err.message })
  }
}

