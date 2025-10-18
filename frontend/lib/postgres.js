// lib/postgres.js
import { neon } from '@neondatabase/serverless'
import pkg from 'pg'

// ✅ Use Neon if available, else fallback to pg.Pool
const connectionString = process.env.DATABASE_URL

let useNeon = true
let sql, pool

try {
  if (!connectionString?.includes('neon.tech')) useNeon = false
} catch {
  useNeon = false
}

if (useNeon) {
  // ✅ Neon serverless (Edge-compatible)
  sql = neon(connectionString)

  // pg-like wrapper for compatibility
  pool = {
    query: async (text, params = []) => {
      const query = text.replace(/\$(\d+)/g, (_, i) =>
        typeof params[i - 1] === 'string'
          ? `'${params[i - 1].replace(/'/g, "''")}'`
          : params[i - 1]
      )
      const result = await sql.unsafe(query)
      return { rows: result }
    },
  }
} else {
  // ✅ Standard Postgres Pool (fallback)
  const { Pool } = pkg
  const pgPool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  })

  pool = pgPool
  sql = {
    unsafe: async (query) => {
      const res = await pgPool.query(query)
      return res.rows
    },
  }
}

export { sql, pool }

