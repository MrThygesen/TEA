// pages/api/initdb.js
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const client = await pool.connect();
  try {
    console.log('🚀 Starting database initialization...');

    // === EVENTS TABLE ===
    await client.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        group_id INTEGER,
        name TEXT NOT NULL,
        city TEXT NOT NULL,
        datetime TIMESTAMPTZ NOT NULL,
        min_attendees INTEGER DEFAULT 1,
        max_attendees INTEGER DEFAULT 40,
        is_confirmed BOOLEAN DEFAULT FALSE,
        description TEXT,
        details TEXT,
        venue TEXT,
        venue_type TEXT, -- NEW column
        basic_perk TEXT,
        advanced_perk TEXT,
        tag1 TEXT,
        tag2 TEXT,
        tag3 TEXT,
        image_url TEXT,
        price NUMERIC(10,2) DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✔ Events table created/ensured');

    // Trigger for updated_at
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);
    await client.query(`DROP TRIGGER IF EXISTS set_updated_at ON events;`);
    await client.query(`
      CREATE TRIGGER set_updated_at
      BEFORE UPDATE ON events
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `);
    console.log('✔ Trigger for events.updated_at ensured');

    // === USER PROFILES TABLE ===
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        telegram_user_id TEXT PRIMARY KEY,
        telegram_username TEXT UNIQUE,
        tier INTEGER DEFAULT 1 CHECK (tier IN (1, 2)),
        email TEXT,
        wallet_address TEXT,
        city TEXT DEFAULT 'Copenhagen',
        role TEXT DEFAULT 'user' CHECK (role IN ('user','organizer','admin')),
        group_id INTEGER,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✔ User profiles table created/ensured');

    // === REGISTRATIONS TABLE ===
    await client.query(`
      CREATE TABLE IF NOT EXISTS registrations (
        id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        telegram_user_id TEXT NOT NULL REFERENCES user_profiles(telegram_user_id) ON DELETE CASCADE,
        telegram_username TEXT,
        email TEXT,
        wallet_address TEXT,
        timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        has_arrived BOOLEAN DEFAULT FALSE,
        voucher_applied BOOLEAN DEFAULT FALSE,
        basic_perk_applied BOOLEAN DEFAULT FALSE,
        advanced_perk_applied BOOLEAN DEFAULT FALSE,
        ticket_validated BOOLEAN DEFAULT FALSE,
        validated_by TEXT,
        validated_at TIMESTAMPTZ,
        has_paid BOOLEAN DEFAULT FALSE,
        paid_at TIMESTAMPTZ,
        UNIQUE (event_id, telegram_user_id)
      );
    `);
    console.log('✔ Registrations table created/ensured');

    // === INVITATIONS TABLE ===
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
    `);
    console.log('✔ Invitations table created/ensured');

    // === EMAIL SUBSCRIBERS TABLE ===
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_emails (
        telegram_user_id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        subscribed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✔ User emails table created/ensured');

    // === City index ===
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_events_city
      ON events(LOWER(city));
    `);
    console.log('✔ Index for events.city ensured');

    res.status(200).json({ message: '✅ Database initialized/updated successfully' });
    console.log('🎉 Database initialized/updated successfully!');
  } catch (err) {
    console.error('❌ Init DB error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}

