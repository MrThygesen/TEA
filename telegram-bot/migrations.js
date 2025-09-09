// migrations.js
import pkg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const { Pool } = pkg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function runMigrations() {
  try {
    // ----------------------------
    // user_profiles
    // ----------------------------
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id SERIAL PRIMARY KEY,
        telegram_user_id TEXT UNIQUE,
        telegram_username TEXT UNIQUE,
        tier INTEGER DEFAULT 1 CHECK (tier IN (1,2)),
        email TEXT UNIQUE,
        wallet_address TEXT,
        city TEXT DEFAULT 'Copenhagen',
        role TEXT DEFAULT 'user' CHECK (role IN ('user','organizer','admin')),
        group_id INTEGER,
        password_hash TEXT,
        is_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ----------------------------
    // events
    // ----------------------------
    await pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        organizer_id INTEGER REFERENCES user_profiles(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        location TEXT,
        start_time TIMESTAMPTZ NOT NULL,
        end_time TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ----------------------------
    // registrations
    // ----------------------------
    await pool.query(`
      CREATE TABLE IF NOT EXISTS registrations (
        id SERIAL PRIMARY KEY,
        event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES user_profiles(id) ON DELETE CASCADE,
        has_arrived BOOLEAN DEFAULT FALSE,
        has_paid BOOLEAN DEFAULT FALSE,
        voucher_applied BOOLEAN DEFAULT FALSE,
        basic_perk_applied BOOLEAN DEFAULT FALSE,
        advanced_perk_applied BOOLEAN DEFAULT FALSE,
        paid_at TIMESTAMPTZ,
        registered_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(event_id, user_id)
      );
    `);

    // ----------------------------
    // invitations
    // ----------------------------
    await pool.query(`
      CREATE TABLE IF NOT EXISTS invitations (
        id SERIAL PRIMARY KEY,
        event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
        inviter_id INTEGER REFERENCES user_profiles(id) ON DELETE CASCADE,
        invitee_email TEXT NOT NULL,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
        sent_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        responded_at TIMESTAMPTZ
      );
    `);

    // ----------------------------
    // user_emails
    // ----------------------------
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_emails (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES user_profiles(id) ON DELETE CASCADE,
        email TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ----------------------------
    // email_verification_tokens
    // ----------------------------
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_verification_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES user_profiles(id) ON DELETE CASCADE,
        telegram_user_id TEXT,
        token TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMPTZ NOT NULL
      );
    `);

    console.log('✅ All migrations applied.');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    throw err;
  }
}

// Optional: run automatically if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations().then(() => process.exit(0)).catch(() => process.exit(1));
}

