// frontend/lib/postgres.js
import { neon } from '@neondatabase/serverless'

const connectionString = process.env.DATABASE_URL

// ✅ Use one lazy client across all API routes
export const sql = neon(connectionString)

// ⚙️ Optional helper for pg-like API
export const pool = {
  query: async (text, params) => {
    // neon uses template literals, not parameter arrays
    // so we convert for compatibility
    const query = text.replace(/\$(\d+)/g, (_, i) =>
      typeof params[i - 1] === 'string' ? `'${params[i - 1].replace(/'/g, "''")}'` : params[i - 1]
    )
    const result = await sql.unsafe(query)
    return { rows: result }
  },
}

