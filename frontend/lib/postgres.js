// lib/postgres.js
let neon
try {
  // ✅ Works for both dev + production
  ;({ neon } = await import('@neondatabase/serverless'))
} catch (err) {
  console.error('⚠️ Neon driver not found, falling back to pg.Pool:', err.message)
  const pkg = await import('pg')
  const { Pool } = pkg
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  export const sql = {
    unsafe: async (query) => {
      const res = await pool.query(query)
      return res.rows
    },
  }
  export const poolCompat = pool
  return
}

const connectionString = process.env.DATABASE_URL
export const sql = neon(connectionString)

// ✅ pg-like wrapper for compatibility
export const pool = {
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

