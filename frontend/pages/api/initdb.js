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
    console.log('🚀 Initializing database...');

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

    // Trigger for updated_at
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE 'plpgsql';
    `);
    await client.query(`DROP TRIGGER IF EXISTS set_updated_at ON events;`);
    await client.query(`
      CREATE TRIGGER set_updated_at
      BEFORE UPDATE ON events
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `);

    // === USER PROFILES TABLE ===
    await client.query(`
  CREATE TABLE IF NOT EXISTS user_profiles (
    id SERIAL PRIMARY KEY,
    telegram_user_id TEXT UNIQUE,
    telegram_username TEXT UNIQUE,
    tier INTEGER DEFAULT 1 CHECK (tier IN (1, 2)),
    email TEXT UNIQUE,
    wallet_address TEXT,
    city TEXT DEFAULT 'Copenhagen',
    role TEXT DEFAULT 'user' CHECK (role IN ('user','organizer','admin')),
    group_id INTEGER,
    password_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );
`);



    // === REGISTRATIONS TABLE ===
    await client.query(`
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
    UNIQUE (event_id, user_id)
  );
`);

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

// === USER EMAILS TABLE ===
await client.query(`
  CREATE TABLE IF NOT EXISTS user_emails (
    user_id INTEGER PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    subscribed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );
`);




    // === EMAIL VERIFICATION TOKENS TABLE ===
await client.query(`
  CREATE TABLE IF NOT EXISTS email_verification_tokens (
    token TEXT PRIMARY KEY,
    user_id INTEGER REFERENCES user_profiles(id) ON DELETE CASCADE,
    telegram_user_id TEXT REFERENCES user_profiles(telegram_user_id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT email_verif_user_or_telegram CHECK (
      user_id IS NOT NULL OR telegram_user_id IS NOT NULL
    )
  );
`);

    // === Indexes ===
await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_email_verif_userid ON email_verification_tokens(user_id);`);
await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_email_verif_tgid ON email_verification_tokens(telegram_user_id);`);


    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_events_city
      ON events(LOWER(city));
    `);

    res.status(200).json({ message: '✅ Database initialized successfully' });
    console.log('🎉 Database initialized successfully!');
  } catch (err) {
    console.error('❌ Init DB error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}





