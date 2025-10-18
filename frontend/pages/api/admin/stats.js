// pages/api/admin/stats.js
import { sql, pool } from '../../../lib/postgres.js'
import { auth } from '../../../lib/auth.js'

export default async function handler(req, res) {
  try {
    // get token (works with Authorization header or cookie depending on your auth util)
    const token = auth.getTokenFromReq(req)
    if (!token) return res.status(401).json({ error: 'Unauthorized - missing token' })

    const user = auth.verifyToken(token)
    if (!user) return res.status(401).json({ error: 'Unauthorized - invalid token' })

    const email = user.email

    // Get events owned by this user
    const eventsResult = await pool.query(
      `SELECT id, name, admin_email, price, datetime, status
       FROM events
       WHERE admin_email = $1
       ORDER BY datetime DESC`,
      [email]
    )
    const events = eventsResult.rows || []

    // If no events, return empty metrics
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

    // Compute per-event metrics
    const eventStats = await Promise.all(events.map(async (ev) => {
      // tickets_sold: registrations with stage='book' (booked tickets)
      const ticketsRes = await pool.query(
        `SELECT COUNT(*)::int AS tickets_sold,
                SUM(CASE WHEN has_paid THEN 1 ELSE 0 END)::int AS paid_count
         FROM registrations
         WHERE event_id = $1 AND stage = 'book'`,
        [ev.id]
      )
      const tickets_sold = ticketsRes.rows[0]?.tickets_sold || 0

      // RSVPs
      const rsvpRes = await pool.query(
        `SELECT COUNT(*)::int AS rsvp_count
         FROM rsvps
         WHERE event_id = $1`,
        [ev.id]
      )
      const rsvp_count = rsvpRes.rows[0]?.rsvp_count || 0

      // show rate: percentage of registrations (book) where has_arrived = true
      const showRes = await pool.query(
        `SELECT
           COALESCE(
             ROUND(
               (SUM(CASE WHEN has_arrived THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*),0)) * 100
             , 1)
           , 0) AS show_rate
         FROM registrations
         WHERE event_id = $1 AND stage = 'book'`,
        [ev.id]
      )
      const show_rate = showRes.rows[0]?.show_rate ?? 0

      // revenue: tickets_sold * event.price (events.price is NUMERIC)
      const priceNum = Number(ev.price || 0)
      const revenue = Number((tickets_sold * priceNum).toFixed(2))

      return {
        id: ev.id,
        name: ev.name,
        datetime: ev.datetime,
        rsvp_count,
        tickets_sold,
        revenue,
        show_rate,
        status: ev.status || null,
      }
    }))

    // Aggregates
    const totalTickets = eventStats.reduce((a, e) => a + (e.tickets_sold || 0), 0)
    const totalRSVPs = eventStats.reduce((a, e) => a + (e.rsvp_count || 0), 0)
    const totalRevenue = eventStats.reduce((a, e) => a + (e.revenue || 0), 0)
    const avgShowRate =
      eventStats.length > 0
        ? (eventStats.reduce((a, e) => a + (Number(e.show_rate) || 0), 0) / eventStats.length)
        : 0

    res.status(200).json({
      tickets_sold: totalTickets,
      rsvp_count: totalRSVPs,
      venues_opened: events.length,
      host_views: 0, // you can implement host_views if you track it
      no_show_rate: Number((100 - avgShowRate).toFixed(1)),
      total_revenue: Number(totalRevenue.toFixed(2)),
      eventStats,
    })
  } catch (err) {
    console.error('❌ /api/admin/stats error:', err)
    res.status(500).json({ error: err.message })
  }
}

