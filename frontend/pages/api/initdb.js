// pages/api/initdb.js
import pkg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const { Pool } = pkg;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('🔹 Initializing database...');

    // ----------------------------
    // WEB USER PROFILES
    // ----------------------------
    await pool.query(`
      CREATE TABLE IF NOT EXISTS web_user_profiles (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE,
        email TEXT UNIQUE,
        password_hash TEXT,
        email_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ----------------------------
    // WEB EMAIL VERIFICATION TOKENS
    // ----------------------------
    await pool.query(`
      CREATE TABLE IF NOT EXISTS web_email_verification_tokens (
        token TEXT PRIMARY KEY,
        user_id INTEGER REFERENCES web_user_profiles(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMPTZ NOT NULL
      );
    `);

    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_web_email_verif_userid
      ON web_email_verification_tokens(user_id);`);

    // ----------------------------
    // USER PROFILES
    // ----------------------------
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id SERIAL PRIMARY KEY,
        telegram_user_id TEXT UNIQUE,
        telegram_username TEXT UNIQUE,
        username TEXT UNIQUE,
        tier INTEGER DEFAULT 1 CHECK (tier IN (1,2)),
        email TEXT UNIQUE,
        wallet_address TEXT,
        city TEXT DEFAULT 'Copenhagen',
        role TEXT DEFAULT 'user' CHECK (role IN ('user','organizer','admin')),
        group_id INTEGER,
        password_hash TEXT,
        email_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ----------------------------
    // EMAIL VERIFICATION TOKENS
    // ----------------------------
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_verification_tokens (
        token TEXT PRIMARY KEY,
        user_id INTEGER REFERENCES user_profiles(id) ON DELETE CASCADE,
        telegram_user_id TEXT,
        email TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMPTZ NOT NULL,
        CONSTRAINT email_verif_user_or_telegram CHECK (user_id IS NOT NULL OR telegram_user_id IS NOT NULL)
      );
    `);

    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_email_verif_userid
      ON email_verification_tokens(user_id);`);

    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_email_verif_tgid
      ON email_verification_tokens(telegram_user_id);`);

    // ----------------------------
    // EVENTS
    // ----------------------------
    await pool.query(`
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
        venue_type TEXT,
        basic_perk TEXT,
        advanced_perk TEXT,
        tag1 TEXT,
        tag2 TEXT,
        tag3 TEXT,
        price NUMERIC(10,2) DEFAULT 0,
        image_url TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_events_city ON events(LOWER(city));`);

    // ----------------------------
    // REGISTRATIONS
    // ----------------------------
    await pool.query(`
      CREATE TABLE IF NOT EXISTS registrations (
        id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
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
        ticket_sent BOOLEAN DEFAULT FALSE,
        UNIQUE(event_id, user_id)
      );
    `);

    // ----------------------------
    // INVITATIONS
    // ----------------------------
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

    // ----------------------------
    // USER EMAILS
    // ----------------------------
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_emails (
        user_id INTEGER PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        subscribed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ----------------------------
    // updated_at trigger function
    // ----------------------------
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE 'plpgsql';
    `);

    // ----------------------------
    // drop triggers first (if exist)
    // ----------------------------
    await pool.query(`DROP TRIGGER IF EXISTS trg_update_user_profiles_updated_at ON user_profiles;`);
    await pool.query(`DROP TRIGGER IF EXISTS trg_update_events_updated_at ON events;`);

    // ----------------------------
    // attach triggers
    // ----------------------------
    await pool.query(`
      CREATE TRIGGER trg_update_user_profiles_updated_at
      BEFORE UPDATE ON user_profiles
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `);

    await pool.query(`
      CREATE TRIGGER trg_update_events_updated_at
      BEFORE UPDATE ON events
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `);

    console.log('✅ Database fully initialized.');
    res.status(200).json({ success: true, message: 'Database fully initialized' });
  } catch (err) {
    console.error('❌ InitDB error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  } finally {
    await pool.end();
  }
}

