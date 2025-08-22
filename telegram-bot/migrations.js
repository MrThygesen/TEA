// telegram-bot/migrations.js
import { pool } from './lib/postgres.js';

export async function runMigrations() {
  console.log('🚀 Running safe migrations...');

  try {
    // === EVENTS TABLE ===
    await pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        group_id TEXT,
        name TEXT NOT NULL,
        city TEXT NOT NULL,
        datetime TIMESTAMPTZ NOT NULL,
        min_attendees INTEGER DEFAULT 1,
        max_attendees INTEGER DEFAULT 40,
        is_confirmed BOOLEAN DEFAULT FALSE,
        description TEXT,
        details TEXT,
        venue TEXT,
        basic_perk TEXT,
        advanced_perk TEXT,
        image_url TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure new columns exist (safe patching)
    const eventColumns = ['tag1', 'tag2', 'tag3'];
    for (const col of eventColumns) {
      await pool.query(
        `ALTER TABLE events ADD COLUMN IF NOT EXISTS ${col} TEXT;`
      );
    }

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
    `);

    // === USER PROFILES TABLE ===
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        telegram_user_id TEXT PRIMARY KEY,
        telegram_username TEXT UNIQUE,
        tier INTEGER DEFAULT 1 CHECK (tier IN (1, 2)),
        email TEXT,
        wallet_address TEXT,
        city TEXT DEFAULT 'Copenhagen',
        role TEXT DEFAULT 'user' CHECK (role IN ('user','organizer','admin')),
        group_id TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // === REGISTRATIONS TABLE ===
    await pool.query(`
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
        UNIQUE (event_id, telegram_user_id)
      );
    `);

    // === INVITATIONS TABLE ===
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
    `);

    // === EMAIL SUBSCRIBERS TABLE ===
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_emails (
        telegram_user_id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        subscribed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Index for city filtering
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_events_city
      ON events(LOWER(city));
    `);

    console.log('✅ Migrations complete and schema is up-to-date!');
  } catch (err) {
    console.error('❌ Migration error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Allow standalone execution: `node migrations.js`
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations();
}

