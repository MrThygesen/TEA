import pkg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const { Pool } = pkg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required on Render for external Postgres
  }
})

const init = async () => {
  const client = await pool.connect()

  try {
    // Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        group_id TEXT,
        name TEXT,
        datetime TIMESTAMPTZ,
        min_attendees INTEGER DEFAULT 20,
        max_attendees INTEGER DEFAULT 40,
        is_confirmed BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
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
        timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `)

    console.log('✅ PostgreSQL tables created successfully.')

    // Check if events already exist
    const res = await client.query('SELECT COUNT(*) FROM events')
    if (parseInt(res.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO events (group_id, name, datetime, min_attendees, max_attendees, is_confirmed)
        VALUES
          ('-1001234567890', 'Coffee & Co-Work – Aug 12', '2025-08-12 10:00:00+02', 20, 40, false),
          ('-1001234567891', 'Startup Legal Meetup – Aug 15', '2025-08-15 17:00:00+02', 20, 40, false),
          ('-1001234567892', 'DAO Builder Talk – Aug 20', '2025-08-20 18:00:00+02', 20, 40, false);
      `)
      console.log('☕ Injected 3 sample events into the database.')
    } else {
      console.log('📌 Events already exist, skipping insertion.')
    }

  } catch (err) {
    console.error('❌ Error during DB init:', err)
  } finally {
    client.release()
    process.exit()
  }
}

init()

