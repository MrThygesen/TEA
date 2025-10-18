// pages/api/cdump.js
import { pool } from '../../lib/postgres.js'
import { globalCache } from '../../lib/cache.js'

export default async function handler(req, res) {
  const cache = getCDumpCache()
  if (cache) {
    return res.json({ cached: true, ttl: cache.ttl / 1000, ...cache.data })
  }

  try {
    // --- Fetch basic event info only (no counts)
    const result = await pool.query(`
      SELECT 
        e.id,
        e.name,
        e.city,
        e.datetime,
        e.venue,
        e.venue_type,
        e.price,
        e.max_attendees,
        e.is_confirmed,
        e.basic_perk,
        e.advanced_perk,
        e.tag1, e.tag2, e.tag3, e.tag4,
        e.image_url
      FROM events e
      ORDER BY e.datetime DESC
      LIMIT 100
    `)

    const rows = result.rows || []

    // --- Merge per-event caches
    const events = rows.map((e) => {
      const regCache = globalEventCache[`registration-${e.id}`]?.data?.total || 0
      const favCache = globalEventCache[`favorite-${e.id}`]?.data?.count || 0
      const rsvpCache = globalEventCache[`rsvp-${e.id}`]?.data?.count || 0

      return {
        ...e,
        total_tickets: regCache,
        paid_tickets: regCache, // optional: refine if you want only paid
        favorites: favCache,
        rsvps: rsvpCache,
      }
    })

    const payload = { events, updatedAt: new Date().toISOString() }

    // --- Compute activity hash
    const totalActivity = events.reduce((acc, e) => acc + e.total_tickets + e.favorites + e.rsvps, 0)
    const newHash = `${events.length}-${totalActivity}`

    // --- Smart TTL adjustment
    let newTTL = 20000
    if (cache?.lastHash && cache.lastHash !== newHash) {
      newTTL = 5000
      console.log(`⚡ Activity detected → cache TTL = ${newTTL / 1000}s`)
    }

    setCDumpCache(payload, newHash, newTTL)

    return res.json({ cached: false, ttl: newTTL / 1000, ...payload })
  } catch (err) {
    console.error('❌ cdump.js error:', err)
    if (cache?.fallback) {
      console.warn('⚠️ Serving fallback data.')
      return res.json({ cached: true, fallback: true, ...cache.fallback })
    }
    return res.status(500).json({ error: 'Server error', details: err.message })
  }
}

