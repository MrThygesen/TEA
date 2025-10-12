import pkg from 'pg'
import dotenv from 'dotenv'
dotenv.config()
const { Pool } = pkg

export default async function handler(req, res) {
  const { userId } = req.query

  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' })
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })

  try {
    const [[rsvpCount], [paidCount], [arrivedCount], [favoritesCount]] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM rsvps WHERE user_id = $1`, [userId]),
      pool.query(`SELECT COUNT(*) FROM registrations WHERE user_id = $1 AND (has_paid = TRUE OR (has_paid = FALSE AND (event_price IS NULL OR event_price = 0)))
`, [userId]),
      pool.query(`SELECT COUNT(*) FROM registrations WHERE user_id = $1 AND has_arrived = true`, [userId]),
      pool.query(`SELECT COUNT(*) FROM favorites WHERE user_id = $1`, [userId]),
    ])

    const rsvps = parseInt(rsvpCount.rows[0].count || 0)
    const ticketsBought = parseInt(paidCount.rows[0].count || 0)
    const arrivals = parseInt(arrivedCount.rows[0].count || 0)
    const favorites = parseInt(favoritesCount.rows[0].count || 0)

    const showUpRate = ticketsBought > 0 ? Math.round((arrivals / ticketsBought) * 100) : 0

    // Points: 1 point per arrival for standard events
    const points = arrivals

    // Free rewards: 1 free for each 9 points attended
    const freeRewards = Math.floor(points / 9)
    const pointsTowardNextFree = points % 9

    res.status(200).json({
      tickets_bought: ticketsBought,
      rsvp_count: rsvps,
      favorites,
      show_up_rate: showUpRate,
      points,
      free_rewards: freeRewards,
      points_toward_next_free: pointsTowardNextFree
    })
  } catch (err) {
    console.error('❌ User metrics error:', err)
    res.status(500).json({ error: 'Server error', details: err.message })
  } finally {
    await pool.end()
  }
}

