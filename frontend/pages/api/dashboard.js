// pages/api/dashboard.js
import { pool } from '../../lib/postgres.js'
import { auth } from '../../lib/auth.js'
import { getCDumpCache } from '../../lib/cache.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Use GET' })

  const token = auth.getTokenFromReq(req)
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  let user
  try {
    user = auth.verifyToken(token)
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }

  try {
    // ------------------------------
    // 1️⃣ Get user profile
    // ------------------------------
    const { rows: profileRows } = await pool.query(
      `SELECT id, username, email, tier, role, city, wallet_address
       FROM user_profiles
       WHERE id = $1`,
      [user.id]
    )
    const profile = profileRows[0]
    if (!profile) return res.status(404).json({ error: 'User not found' })

    // ------------------------------
    // 2️⃣ Tickets (registrations)
    // ------------------------------
    const { rows: tickets } = await pool.query(
      `
      SELECT 
        r.id AS ticket_id,
        r.ticket_code,
        r.has_paid,
        r.stage,
        r.timestamp,
        e.id AS event_id,
        e.name AS event_title,
        e.datetime AS event_date,
        e.venue AS location,
        e.city,
        e.price AS event_price,
        e.venue_type,
        e.basic_perk,
        e.advanced_perk
      FROM registrations r
      JOIN events e ON e.id = r.event_id
      WHERE r.user_id = $1
      ORDER BY e.datetime DESC
      `,
      [user.id]
    )

    // ------------------------------
    // 3️⃣ RSVPs
    // ------------------------------
    const { rows: rsvps } = await pool.query(
      `
      SELECT 
        r.id AS rsvp_id,
        r.event_id,
        e.name AS title,
        e.datetime AS date,
        e.venue AS location,
        e.city,
        e.price,
        e.venue_type
      FROM rsvps r
      JOIN events e ON e.id = r.event_id
      WHERE r.user_id = $1
      ORDER BY e.datetime DESC
      `,
      [user.id]
    )

    // ------------------------------
    // 4️⃣ Event data (cached cdump)
    // ------------------------------
    let eventData = null
    try {
      const cache = await getCDumpCache()
      if (cache?.data?.events) eventData = cache.data.events
      else {
        const { rows } = await pool.query(`
          SELECT id, name, city, datetime, venue_type, image_url, price
          FROM events ORDER BY datetime DESC LIMIT 100
        `)
        eventData = rows
      }
    } catch (err) {
      console.warn('⚠️ Could not load cdump cache:', err.message)
      eventData = []
    }

    // ------------------------------
    // 5️⃣ Metrics for client/admin
    // ------------------------------
    let metrics = {}
    if (['admin', 'client'].includes(profile.role)) {
      const { rows: stats } = await pool.query(`
        SELECT 
COUNT(*) FILTER (WHERE has_paid=TRUE) AS tickets_paid,
COUNT(*) FILTER (WHERE has_paid=FALSE) AS tickets_free,
COUNT(*) AS tickets_total,
          COUNT(DISTINCT rsvp.id) AS rsvp_count,
          COUNT(DISTINCT e.venue) AS venues_opened,
          COUNT(DISTINCT e.id) FILTER (WHERE e.is_confirmed=TRUE) AS host_views
        FROM events e
        LEFT JOIN registrations reg ON reg.event_id = e.id
        LEFT JOIN rsvps rsvp ON rsvp.event_id = e.id
      `)
      metrics = stats[0] || {}
    } else {
      // User metrics
      const { rows: userStats } = await pool.query(`
          SELECT 
  COUNT(*) AS tickets_total,
  COUNT(*) FILTER (WHERE has_paid=TRUE) AS tickets_paid,
  COUNT(*) FILTER (WHERE has_paid=FALSE) AS tickets_free,
  ROUND(100 * SUM(CASE WHEN has_arrived THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*),0),1) AS show_up_rate,
  COALESCE(SUM(CASE WHEN has_paid THEN 5 ELSE 1 END),0) AS points
FROM registrations
WHERE user_id=$1

      `, [user.id])
      metrics = userStats[0] || {}
    }

    // ------------------------------
    // 6️⃣ Respond with full payload
    // ------------------------------
    res.status(200).json({
      profile,
      tickets,
      rsvps,
      events: eventData,
      metrics,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('❌ dashboard.js error:', err)
    res.status(500).json({ error: 'Server error', details: err.message })
  }
}

