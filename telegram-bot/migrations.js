// telegram-bot/migrations.js
import { pool } from './lib/postgres.js'

export async function runMigrations() {
  console.log('Running safe migrations...')

  // 1️⃣ Events table (create if missing, add city column if missing)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      city TEXT,
      datetime TIMESTAMP,
      min_attendees INTEGER,
      is_confirmed BOOLEAN DEFAULT false,
      group_id BIGINT
    );
  `)
  console.log('✅ Events table ready.')

  // Ensure 'city' column exists (if you previously had a table without it)
  await pool.query(`
    ALTER TABLE events
    ADD COLUMN IF NOT EXISTS city TEXT;
  `)

  // 2️⃣ Registrations table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS registrations (
      event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
      telegram_user_id TEXT NOT NULL,
      telegram_username TEXT,
      PRIMARY KEY (event_id, telegram_user_id)
    );
  `)
  console.log('✅ Registrations table ready.')

  // 3️⃣ Invitations table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS invitations (
      id SERIAL PRIMARY KEY,
      event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
      inviter_id TEXT NOT NULL,
      invitee_id TEXT,
      invitee_username TEXT,
      confirmed BOOLEAN DEFAULT false
    );
  `)
  console.log('✅ Invitations table ready.')

  // 4️⃣ User emails table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_emails (
      telegram_user_id TEXT PRIMARY KEY,
      email TEXT NOT NULL
    );
  `)
  console.log('✅ User emails table ready.')
  console.log('All migrations complete. No data has been deleted.')

// 5️⃣ User profiles table
await pool.query(`
  CREATE TABLE IF NOT EXISTS user_profiles (
    telegram_user_id TEXT PRIMARY KEY,
    telegram_username TEXT,
    city TEXT DEFAULT 'Copenhagen',
    tier INTEGER DEFAULT 1,
    email TEXT,
    wallet_address TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );
`);
console.log('✅ User profiles table ready.');

}

