// frontend/pages/api/dump.js
import pkg from 'pg'
const { Pool } = pkg

// Log DATABASE_URL once on import
console.log('API /dump: DATABASE_URL =', process.env.DATABASE_URL)

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // needed for Render.com SSL
  },
})

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    const result = await pool.query('SELECT * FROM events ORDER BY datetime ASC')
    return res.status(200).json(result.rows)
  } catch (err) {
    console.error('[API /dump] DB query failed:', err)
    return res.status(500).json({ error: 'Failed to fetch database dump' })
  }
}

