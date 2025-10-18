// lib/postgres.js
import { neon } from '@neondatabase/serverless'
import pkg from 'pg'

const { Pool } = pkg
const connectionString = process.env.DATABASE_URL

let pool

if (process.env.NEON_DRIVER === 'true') {
  console.log('🚀 Using Neon serverless driver')
  const sql = neon(connectionString)
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
  console.log('💾 Using local pg.Pool driver')
  pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  })
}

export { pool }

