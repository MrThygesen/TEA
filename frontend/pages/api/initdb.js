// tea-project/frontend/pages/api/initdb.js
import pkg from 'pg'

const { Pool } = pkg
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    const client = await pool.connect()

    // 1️⃣ Create events table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        group_id TEXT,
        name TEXT,
        city TEXT,
        datetime TIMESTAMPTZ,
        min_attendees INTEGER DEFAULT 1,
        max_attendees INTEGER DEFAULT 40,
        is_confirmed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `)

    // 2️⃣ Ensure city index exists
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_events_city
      ON events(LOWER(city));
    `)

    // 3️⃣ Create registrations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS registrations (
        id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL REFERENCES events(id),
        telegram_user_id TEXT NOT NULL,
        telegram_username TEXT,
        email TEXT,
        wallet_address TEXT,
        tier INTEGER DEFAULT 1,
        ticket_code TEXT UNIQUE,
        wallet_verified BOOLEAN DEFAULT FALSE,
        timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (event_id, telegram_user_id)
      );
    `)

    // 4️⃣ Create invitations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS invitations (
        id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        inviter_id TEXT NOT NULL,
        inviter_username TEXT,
        invitee_id TEXT,
        invitee_username TEXT,
        confirmed BOOLEAN DEFAULT FALSE,
        timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `)

    // 5️⃣ Create user_emails table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_emails (
        telegram_user_id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        subscribed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `)

    // 6️⃣ Generate ticket_code for existing registrations if missing
    const existing = await client.query(`SELECT id, ticket_code FROM registrations WHERE ticket_code IS NULL`)
    for (const row of existing.rows) {
      const code = `TICKET-${row.id.toString().padStart(5, '0')}-${Math.random().toString(36).slice(2,7).toUpperCase()}`
      await client.query(`UPDATE registrations SET ticket_code=$1 WHERE id=$2`, [code, row.id])
      console.log(`✅ Set ticket_code for registration id=${row.id}: ${code}`)
    }

    client.release()
    res.status(200).json({ message: '✅ Database initialized/updated successfully' })
  } catch (err) {
    console.error('❌ Init DB error:', err)
    res.status(500).json({ error: err.message })
  }
}

