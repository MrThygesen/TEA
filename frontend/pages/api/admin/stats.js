// frontend/pages/api/admin/stats.js
import { pool } from '../../../lib/postgres.js'
import { verifyToken } from '../../../lib/auth.js'

export default async function handler(req, res) {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) return res.status(401).json({ error: 'Missing token' })

    const user = verifyToken(token)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

    const email = user.email

    // 🟢 Get all events owned by this user
    const eventsResult = await pool.query(
      `SELECT id, name, admin_email
       FROM events
       WHERE admin_email = $1`,
      [email]
    )
    const events = eventsResult.rows

    // If user has no events
    if (!events.length) {
      return res.status(200).json({
        tickets_sold: 0,
        rsvp_count: 0,
        venues_opened: 0,
        host_views: 0,
        no_show_rate: 0,
        total_revenue: 0,
        eventStats: [],
      })
    }

    // 🟢 Per-event metrics
    const eventStats = await Promise.all(
      events.map(async (ev) => {
        const ticketData = await pool.query(
          `SELECT COUNT(*)::int AS tickets_sold, COALESCE(SUM(price), 0)::float AS revenue
           FROM tickets WHERE event_id = $1`,
          [ev.id]
        )

        const rsvpData = await pool.query(
          `SELECT COUNT(*)::int AS rsvp_count
           FROM rsvps WHERE event_id = $1`,
          [ev.id]
        )

        const showRateData = await pool.query(
          `SELECT 
              ROUND(
                (SUM(CASE WHEN attended = true THEN 1 ELSE 0 END)::decimal / 
                 NULLIF(COUNT(*), 0)) * 100, 1
              ) AS show_rate
           FROM tickets WHERE event_id = $1`,
          [ev.id]
        )

        return {
          id: ev.id,
          name: ev.name,
          rsvp_count: rsvpData.rows[0]?.rsvp_count || 0,
          tickets_sold: ticketData.rows[0]?.tickets_sold || 0,
          revenue: ticketData.rows[0]?.revenue || 0,
          show_rate: showRateData.rows[0]?.show_rate || 0,
        }
      })
    )

    // 🟢 Aggregate totals
    const totalTickets = eventStats.reduce((a, e) => a + e.tickets_sold, 0)
    const totalRSVPs = eventStats.reduce((a, e) => a + e.rsvp_count, 0)
    const totalRevenue = eventStats.reduce((a, e) => a + e.revenue, 0)
    const avgShowRate =
      eventStats.length > 0
        ? (eventStats.reduce((a, e) => a + (e.show_rate || 0), 0) / eventStats.length).toFixed(1)
        : 0

    // 🟢 Send response
    res.status(200).json({
      tickets_sold: totalTickets,
      rsvp_count: totalRSVPs,
      venues_opened: events.length,
      host_views: 0, // optional if not tracked
      no_show_rate: 100 - avgShowRate,
      total_revenue: totalRevenue,
      eventStats,
    })
  } catch (err) {
    console.error('❌ /api/admin/stats error:', err)
    res.status(500).json({ error: err.message })
  }
}

