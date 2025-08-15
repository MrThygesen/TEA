// telegram-bot/migrations.js
import { pool } from './lib/postgres.js'

export async function runMigrations() {
  console.log('Running safe migrations...')

  // 1️⃣ Events table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      group_id TEXT,
      name TEXT,
      city TEXT,
      datetime TIMESTAMPTZ,
      min_attendees INTEGER DEFAULT 1,
      max_attendees INTEGER DEFAULT 40,
      is_confirmed BOOLEAN DEFAULT FALSE,
      description TEXT,
      venue TEXT,
      basic_perk TEXT,
      advanced_perk TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `)
  console.log('✅ Events table ready.')

  // Ensure columns exist (for upgrades)
  await pool.query(`
    ALTER TABLE events
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS venue TEXT,
    ADD COLUMN IF NOT EXISTS basic_perk TEXT,
    ADD COLUMN IF NOT EXISTS advanced_perk TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
  `)

  // Trigger for updated_at
  await pool.query(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ language 'plpgsql';

    DROP TRIGGER IF EXISTS set_updated_at ON events;
    CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `)

  // Index for city filtering
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_events_city ON events(LOWER(city));
  `)

  // 2️⃣ Registrations table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS registrations (
      id SERIAL PRIMARY KEY,
      event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      telegram_user_id TEXT NOT NULL,
      telegram_username TEXT,
      email TEXT,
      wallet_address TEXT,
      timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (event_id, telegram_user_id)
    );
  `)
  console.log('✅ Registrations table ready.')

  // 3️⃣ Invitations table
  await pool.query(`
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
  console.log('✅ Invitations table ready.')

  // 4️⃣ User emails table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_emails (
      telegram_user_id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      subscribed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `)
  console.log('✅ User emails table ready.')

  // 5️⃣ User profiles table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      telegram_user_id TEXT PRIMARY KEY,
      telegram_username TEXT,
      tier INTEGER DEFAULT 1 CHECK (tier IN (1, 2)),
      email TEXT,
      wallet_address TEXT,
      city TEXT DEFAULT 'Copenhagen',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `)
  console.log('✅ User profiles table ready.')

  console.log('All migrations complete. No data has been deleted.')
}

