import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // important for Render Postgres from Vercel
})

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    const client = await pool.connect()
    const result = await client.query('SELECT * FROM events ORDER BY datetime DESC')
    client.release()

    return res.status(200).json(result.rows)
  } catch (err) {
    console.error('[API /dump] DB query failed:', err)
    return res.status(500).json({ error: 'Failed to fetch database dump' })
  }
}

