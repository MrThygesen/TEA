// frontend/lib/postgres.js
import pkg from 'pg'
const { Pool } = pkg

// Use a global variable to avoid creating multiple pools during hot reloads
if (!global._pgPool) {
  global._pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 20,                // maximum number of clients in the pool
    idleTimeoutMillis: 30000, // close idle clients after 30s
    connectionTimeoutMillis: 2000, // fail if connection not established in 2s
  })
}

export const pool = global._pgPool

