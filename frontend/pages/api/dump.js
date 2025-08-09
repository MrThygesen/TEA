// api/dump.js  (for Vercel Serverless Function)
import { Pool } from 'pg'

export default async function handler(req, res) {
  // 1. Ensure DATABASE_URL is present
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ error: 'DATABASE_URL is not set' })
  }

  // 2. Create a connection pool (avoid global leaks in serverless)
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // Needed for Render/Postgres
  })

  try {
    // 3. Fetch all events & registrations
    const events = await pool.query('SELECT * FROM events ORDER BY created_at DESC')
    const registrations = await pool.query('SELECT * FROM registrations')

    // 4. Send JSON
    return res.status(200).json({
      events: events.rows,
      registrations: registrations.rows,
    })
  } catch (err) {
    console.error('❌ Dump API error:', err)
    return res.status(500).json({ error: err.message })
  } finally {
    await pool.end()
  }
}

