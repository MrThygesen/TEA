// tea-project/telegram-bot/scripts/initProgres.js
import pkg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const { Pool } = pkg
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

export async function run() {
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        group_id TEXT,
        name TEXT,
        datetime TIMESTAMPTZ,
        min_attendees INTEGER DEFAULT 1,
        max_attendees INTEGER DEFAULT 40,
        is_confirmed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS registrations (
        id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL REFERENCES events(id),
        telegram_user_id TEXT NOT NULL,
        telegram_username TEXT,
        email TEXT,
        wallet_address TEXT,
        timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (event_id, telegram_user_id)
      );
    `)

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

    console.log('✅ Database schema updated.')
  } catch (err) {
    console.error('❌ Error initializing DB:', err)
    throw err
  } finally {
    client.release()
  }
}

// If run directly via CLI
if (process.argv[1] === new URL(import.meta.url).pathname) {
  run().then(() => process.exit(0))
}

