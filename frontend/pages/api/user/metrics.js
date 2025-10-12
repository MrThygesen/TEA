//metrics.js

import pkg from 'pg'
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken'

dotenv.config()
const { Pool } = pkg
const TOKEN_KEY = process.env.JWT_SECRET || 'dev_secret'

export default async function handler(req, res) {
  const auth = req.headers.authorization
  if (!auth) {
    return res.status(401).json({ error: 'Missing authorization header' })
  }

  const [, token] = auth.split(' ')
  let userId
  try {
    const decoded = jwt.verify(token, TOKEN_KEY)
    userId = decoded.id
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' })
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })

  try {
    // Run all 4 queries in parallel
    const [rsvpCount, ticketCount, arrivedCount, favoritesCount] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM rsvps WHERE user_id = $1`, [userId]),
      pool.query(
        `SELECT COUNT(*) 
         FROM registrations 
         WHERE user_id = $1 
           AND (
             has_paid = TRUE 
             OR (has_paid = FALSE AND (event_price IS NULL OR event_price = 0))
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

    // Loyalty logic
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
    console.error('❌ User metrics error:', err)
    res.status(500).json({ error: 'Server error', details: err.message })
  } finally {
    await pool.end()
  }
}

