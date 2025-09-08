import pkg from "pg";
const { Client } = pkg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function initDb() {
  try {
    await client.connect();
    console.log("Connected to the database.");

    // Drop all tables first (CASCADE ensures dependencies removed)
    await client.query(`
      DROP TABLE IF EXISTS 
        user_emails,
        invitations,
        registrations,
        events,
        email_verification_tokens,
        user_profiles
      CASCADE;
    `);

    console.log("All tables dropped.");

    // Now execute schema.sql commands (inline for simplicity)
    await client.query(`
      -- USER PROFILES
      CREATE TABLE user_profiles (
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
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      -- EMAIL VERIFICATION TOKENS
      CREATE TABLE email_verification_tokens (
        token TEXT PRIMARY KEY,
        user_id INTEGER REFERENCES user_profiles(id) ON DELETE CASCADE,
        telegram_user_id TEXT,
        email TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMPTZ NOT NULL,
        CONSTRAINT email_verif_user_or_telegram CHECK (
          user_id IS NOT NULL OR telegram_user_id IS NOT NULL
        )
      );

      CREATE UNIQUE INDEX idx_email_verif_userid ON email_verification_tokens(user_id);
      CREATE UNIQUE INDEX idx_email_verif_tgid ON email_verification_tokens(telegram_user_id);

      -- EVENTS
      CREATE TABLE events (
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

      CREATE INDEX idx_events_city ON events(LOWER(city));

      -- REGISTRATIONS
      CREATE TABLE registrations (
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
        UNIQUE(event_id, user_id)
      );

      -- INVITATIONS
      CREATE TABLE invitations (
        id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        inviter_id TEXT NOT NULL,
        inviter_username TEXT,
        invitee_id TEXT,
        invitee_username TEXT,
        confirmed BOOLEAN DEFAULT FALSE,
        timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      -- USER EMAILS
      CREATE TABLE user_emails (
        user_id INTEGER PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        subscribed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      -- TRIGGER FUNCTION
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE 'plpgsql';
    `);

    console.log("Database initialized successfully.");
  } catch (err) {
    console.error("Error initializing database:", err);
  } finally {
    await client.end();
  }
}

initDb();

