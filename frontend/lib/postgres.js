// frontend/lib/postgres.js
import pkg from 'pg'
const { Pool } = pkg

if (!global._pgPool) {
  global._pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10, // fewer clients to avoid hitting limits on Render free plan
    idleTimeoutMillis: 10000, // close idle clients quickly
    connectionTimeoutMillis: 5000, // retry faster
  })

// optional: keep-alive ping every 10 minutes (Render sleeps connections)
//  setInterval(async () => {
//  try {
//    await global._pgPool.query('SELECT 1')
//    } catch (err) {
//     console.warn('Postgres keep-alive failed:', err.message)
//   }
//  }, 600000)
//
}

export const pool = global._pgPool

