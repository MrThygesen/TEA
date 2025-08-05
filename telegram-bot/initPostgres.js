import pkg from 'pg'
import dotenv from 'dotenv'

dotenv.config()
const { Pool } = pkg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // needed for Render
  }
})

const init = async () => {
  const client = await pool.connect()

  await client.query(`
    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      group_id TEXT,
      name TEXT,
      datetime TEXT,
      min_attendees INTEGER DEFAULT 20,
      max_attendees INTEGER DEFAULT 40,
      is_confirmed BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)

  await client.query(`
    CREATE TABLE IF NOT EXISTS registrations (
      id SERIAL PRIMARY KEY,
      event_id INTEGER REFERENCES events(id),
      telegram_user_id TEXT NOT NULL,
      telegram_username TEXT,
      email TEXT,
      wallet_address TEXT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)

  console.log('✅ PostgreSQL tables created.')
  client.release()
  process.exit()
}

init().catch(console.error)

