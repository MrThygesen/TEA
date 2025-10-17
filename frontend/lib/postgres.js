// frontend/lib/postgres.js
import pkg from 'pg'
const { Pool } = pkg

// ✅ Use Neon pooled endpoint (with ?sslmode=require)
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL

if (!global._pgPool) {
  global._pgPool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }, // Neon requires SSL
    max: 10, // keep small for serverless, each is expensive
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
  })

  // 💤 keep-alive ping (avoids Neon cold-start timeouts)
  setInterval(async () => {
    try {
      await global._pgPool.query('SELECT 1')
    } catch (err) {
      console.warn('Postgres keep-alive failed:', err.message)
    }
  }, 600000) // every 10 minutes
}

export const pool = global._pgPool

