// frontend/pages/api/initdb.js
import { sql } from '../../lib/postgres.js'
import dotenv from 'dotenv'
dotenv.config()

const exec = sql?.unsafe
  ? sql.unsafe
  : async (q) => {
      const { pool } = await import('../../lib/postgres.js')
      const r = await pool.query(q)
      return r.rows
    }

export default async function handler(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed. Use POST.' })

  try {
    console.log('🔹 Initializing database...')


    // TELEGRAM USER PROFILES
    await exec(`
      CREATE TABLE IF NOT EXISTS telegram_user_profiles (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE,
        email TEXT UNIQUE,
        password_hash TEXT,
        email_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `)

    // USER PROFILES
    await exec(`
  CREATE TABLE IF NOT EXISTS user_profiles (
    id SERIAL PRIMARY KEY,  
    name TEXT, 
    username TEXT UNIQUE,
    tier INTEGER DEFAULT 1 CHECK (tier IN (1,2)),
    email TEXT UNIQUE,
    wallet_address TEXT,
    city TEXT DEFAULT 'Copenhagen',
    role TEXT DEFAULT 'user' CHECK (role IN ('user','organizer','client', 'event-organizer', 'admin')),
    group_id INTEGER,
    password_hash TEXT,
    email_verified BOOLEAN DEFAULT FALSE,
    gender TEXT CHECK (gender IN ('male','female','other')) DEFAULT NULL, -- ✅ NEW
    birthdate DATE DEFAULT NULL, -- ✅ NEW
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );
`);




    // EMAIL VERIFICATION TOKENS
    await exec(`
      CREATE TABLE IF NOT EXISTS email_verification_tokens (
        token TEXT PRIMARY KEY,
        user_id INTEGER REFERENCES user_profiles(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMPTZ NOT NULL
      );
    `)
    await exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_email_verif_userid
      ON email_verification_tokens(user_id);
    `)

    // EVENTS
await exec(`
  CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    admin_email TEXT NOT NULL REFERENCES user_profiles(email),
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
    tag4 TEXT, -- ✅ new column for extra tags (for filtering, categories, etc.)
    language TEXT DEFAULT 'English', -- ✅ new column for event language
    price NUMERIC(10,2) DEFAULT 0,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    is_rejected BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected'))
  );
`);
    await exec(`CREATE INDEX IF NOT EXISTS idx_events_city ON events(LOWER(city));`)

    // REGISTRATIONS
    await exec(`
      CREATE TABLE IF NOT EXISTS registrations (
        id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES user_profiles(id) ON DELETE CASCADE,
        telegram_user_id INTEGER REFERENCES telegram_user_profiles(id) ON DELETE CASCADE,
        telegram_username TEXT,
        email TEXT,
        wallet_address TEXT,
        timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        has_arrived BOOLEAN DEFAULT FALSE,
        voucher_applied BOOLEAN DEFAULT FALSE,
        basic_perk_applied BOOLEAN DEFAULT FALSE,
        advanced_perk_applied BOOLEAN DEFAULT FALSE,
        ticket_code TEXT UNIQUE,
        ticket_validated BOOLEAN DEFAULT FALSE,
        validated_by TEXT,
        validated_at TIMESTAMPTZ,
        has_paid BOOLEAN DEFAULT FALSE,
        paid_at TIMESTAMPTZ,
        ticket_sent BOOLEAN DEFAULT FALSE,
        stage TEXT CHECK (stage IN ('prebook','book')) DEFAULT 'prebook',
        CONSTRAINT registrations_user_check CHECK (
          user_id IS NOT NULL OR telegram_user_id IS NOT NULL
        )
      );
    `)

    // ❌ REMOVE these unique constraints (we allow multiple rows per user)
    // await exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_event_user ...`)
    // await exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_event_tguser ...`)


// EVENT ORGANIZERS (many-to-many between events and user_profiles)
await exec(`
  CREATE TABLE IF NOT EXISTS event_organizers (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (event_id, user_id) -- prevent duplicate assignment
  );
`);



    // INVITATIONS
    await exec(`
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

    // USER EMAILS
    await exec(`
      CREATE TABLE IF NOT EXISTS user_emails (
        user_id INTEGER PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        subscribed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `)

// FAVORITES
await exec(`
  CREATE TABLE IF NOT EXISTS favorites (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES user_profiles(id) ON DELETE CASCADE,
    telegram_user_id INTEGER REFERENCES telegram_user_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT favorites_user_check CHECK (
      user_id IS NOT NULL OR telegram_user_id IS NOT NULL
    ),
    CONSTRAINT favorites_event_user_unique UNIQUE (event_id, user_id),
    CONSTRAINT favorites_event_telegram_unique UNIQUE (event_id, telegram_user_id)
  );
`);


// Uniqueness: only 1 RSVP per user per event
await exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_favorites_event_user
  ON favorites(event_id, user_id) WHERE user_id IS NOT NULL;
`);

await exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_favorites_event_tg
  ON favorites(event_id, telegram_user_id) WHERE telegram_user_id IS NOT NULL;
`);


    // rsvps
    await exec(`
      CREATE TABLE IF NOT EXISTS rsvps (
        id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES user_profiles(id) ON DELETE CASCADE,
        telegram_user_id INTEGER REFERENCES telegram_user_profiles(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT rsvps_user_check CHECK (
          user_id IS NOT NULL OR telegram_user_id IS NOT NULL
        )
      );
    `)

    // Uniqueness: only 1 like per user per event
    await exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_rsvps_event_user
      ON rsvps(event_id, user_id) WHERE user_id IS NOT NULL;
    `)
    await exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_rsvps_event_tg
      ON rsvps(event_id, telegram_user_id) WHERE telegram_user_id IS NOT NULL;
    `)

    // Indexes for performance
    await exec(`CREATE INDEX IF NOT EXISTS idx_rsvps_event ON rsvps(event_id);`)
    await exec(`CREATE INDEX IF NOT EXISTS idx_rsvps_web ON rsvps(user_id);`)
    await exec(`CREATE INDEX IF NOT EXISTS idx_rsvps_tg ON rsvps(telegram_user_id);`)

// Indexes for performance
await exec(`CREATE INDEX IF NOT EXISTS idx_favorites_event ON favorites(event_id);`);
await exec(`CREATE INDEX IF NOT EXISTS idx_favorites_web ON favorites(user_id);`);
await exec(`CREATE INDEX IF NOT EXISTS idx_favorites_tg ON favorites(telegram_user_id);`);

    // updated_at trigger
    await exec(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE 'plpgsql';
    `)
    await exec(`DROP TRIGGER IF EXISTS trg_update_user_profiles_updated_at ON user_profiles;`)
    await exec(`DROP TRIGGER IF EXISTS trg_update_telegram_user_profiles_updated_at ON telegram_user_profiles;`)
    await exec(`DROP TRIGGER IF EXISTS trg_update_events_updated_at ON events;`)
    await exec(`
      CREATE TRIGGER trg_update_user_profiles_updated_at
      BEFORE UPDATE ON user_profiles
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `)
    await exec(`
      CREATE TRIGGER trg_update_telegram_user_profiles_updated_at
      BEFORE UPDATE ON telegram_user_profiles
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `)
    await exec(`
      CREATE TRIGGER trg_update_events_updated_at
      BEFORE UPDATE ON events
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `)

    console.log('✅ Database fully initialized.')
    res.status(200).json({ success: true, message: 'Database fully initialized' })
  } catch (err) {
    console.error('❌ InitDB error:', err)
    res.status(500).json({ error: 'Server error', details: err.message })
  } 
}
