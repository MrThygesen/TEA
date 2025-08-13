// telegram-bot/migrations.js

import { pool } from './postgres.js'

export async function runMigrations() {
  console.log('Running migrations...')

  // 1️⃣ Drop and recreate events table with city column
  await pool.query(`
    DROP TABLE IF EXISTS events CASCADE;
  `)
  console.log('Dropped old events table.')

  await pool.query(`
    CREATE TABLE events (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      city TEXT,
      datetime TIMESTAMP,
      min_attendees INTEGER,
      is_confirmed BOOLEAN DEFAULT false,
      group_id BIGINT
    );
  `)
  console.log('Created new events table with city column.')

  // 2️⃣ Keep your other migrations here (registrations, invitations, etc.)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS registrations (
      event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
      telegram_user_id TEXT NOT NULL,
      telegram_username TEXT,
      PRIMARY KEY (event_id, telegram_user_id)
    );
  `)

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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_emails (
      telegram_user_id TEXT PRIMARY KEY,
      email TEXT NOT NULL
    );
  `)

  console.log('Migrations complete.')
}

