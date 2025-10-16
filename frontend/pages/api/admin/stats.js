// /api/admin/stats.js
import { pool } from '../../lib/postgres.js'
import { auth } from '../../lib/auth.js'

export default async function handler(req, res) {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    const user = verifyToken(token)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

    const email = user.email
    const role = user.role

    // 🟢 Base query: fetch events the user owns (for clients/admins)
    const [events] = await db.query(
      `SELECT id, name, admin_email
       FROM events
       WHERE admin_email = ?`,
      [email]
    )

    // If user has no events
    if (!events.length) {
      return res.status(200).json({
        tickets_sold: 0,
        rsvp_count: 0,
        venues_opened: 0,
        host_views: 0,
        no_show_rate: 0,
        eventStats: [],
      })
    }

    // 🟢 Per-event metrics
    const eventStats = await Promise.all(events.map(async (ev) => {
      const [[ticketData]] = await db.query(
        `SELECT COUNT(*) AS tickets_sold, SUM(price) AS revenue
         FROM tickets WHERE event_id = ?`,
        [ev.id]
      )

      const [[rsvpData]] = await db.query(
        `SELECT COUNT(*) AS rsvp_count FROM rsvps WHERE event_id = ?`,
        [ev.id]
      )

      const [[showRateData]] = await db.query(
        `SELECT 
            ROUND(SUM(CASE WHEN attended=1 THEN 1 ELSE 0 END) / COUNT(*) * 100, 1) AS show_rate
         FROM tickets WHERE event_id = ?`,
        [ev.id]
      )

      return {
        id: ev.id,
        name: ev.name,
        rsvp_count: rsvpData.rsvp_count || 0,
        tickets_sold: ticketData.tickets_sold || 0,
        revenue: ticketData.revenue || 0,
        show_rate: showRateData.show_rate || 0,
      }
    }))

    // 🟢 Aggregate totals
    const totalTickets = eventStats.reduce((a, e) => a + e.tickets_sold, 0)
    const totalRSVPs = eventStats.reduce((a, e) => a + e.rsvp_count, 0)
    const totalRevenue = eventStats.reduce((a, e) => a + (e.revenue || 0), 0)
    const avgShowRate =
      eventStats.length > 0
        ? (eventStats.reduce((a, e) => a + e.show_rate, 0) / eventStats.length).toFixed(1)
        : 0

    res.status(200).json({
      tickets_sold: totalTickets,
      rsvp_count: totalRSVPs,
      venues_opened: events.length,
      host_views: 0, // optional if you track this
      no_show_rate: 100 - avgShowRate,
      total_revenue: totalRevenue,
      eventStats,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
}

