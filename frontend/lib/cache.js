// lib/cache.js
// 🔥 Central shared cache state (in-memory, per server instance)
export const globalCache = {
  cdump: { data: null, ts: 0, ttl: 20000, lastHash: null, fallback: null },
  perEvent: {}, // store per-event caches: favorites, RSVPs, registrations
}

// ✅ Get CDump cache
export function getCDumpCache() {
  const cache = globalCache.cdump
  const now = Date.now()
  if (cache.data && now - cache.ts < cache.ttl) return cache
  return null
}

// ✅ Set CDump cache
export function setCDumpCache(payload, lastHash, ttl = 20000) {
  globalCache.cdump = {
    data: payload,
    ts: Date.now(),
    ttl,
    lastHash,
    fallback: payload,
  }
}

// ✅ Invalidate CDump cache
export function invalidateCDump(reason = '') {
  if (globalCache.cdump?.data) {
    console.log(`🧹 Cache invalidated: ${reason || 'manual'}`)
    globalCache.cdump.ts = 0
  }
}

// ✅ Get per-event cache
export function getEventCache(eventId, type) {
  const cache = globalCache.perEvent[`${type}-${eventId}`]
  const now = Date.now()
  if (cache && cache.data && now - cache.ts < cache.ttl) return cache
  return null
}

// ✅ Set per-event cache
export function setEventCache(eventId, type, data, ttl = 5000) {
  globalCache.perEvent[`${type}-${eventId}`] = {
    data,
    ts: Date.now(),
    ttl,
  }
}

// ✅ Invalidate per-event cache
export function invalidateEventCache(eventId, type, reason = '') {
  if (globalCache.perEvent[`${type}-${eventId}`]) {
    console.log(`🧹 Per-event cache invalidated: ${type}-${eventId} (${reason})`)
    delete globalCache.perEvent[`${type}-${eventId}`]
  }
}

