// pages/api/initdb.js
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const client = await pool.connect();
  try {
    // === USER PROFILES TABLE ===
    await client.query(`
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
        is_verified BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // === EVENTS TABLE ===
    await client.query(`
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

    // === REGISTRATIONS TABLE ===
    await client.query(`
      CREATE TABLE IF NOT EXISTS registrations (
        id SERIAL PRIMARY KEY,
        event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES user_profiles(id) ON DELETE CASCADE,
        registered_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(event_id, user_id)
      );
    `);

    // === INVITATIONS TABLE ===
    await client.query(`
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

    // === USER EMAILS TABLE ===
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_emails (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES user_profiles(id) ON DELETE CASCADE,
        email TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // === EMAIL VERIFICATION TOKENS TABLE ===
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_verification_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES user_profiles(id) ON DELETE CASCADE,
        token TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMPTZ NOT NULL
      );
    `);

    res.status(200).json({ message: "Database initialized successfully" });
  } catch (err) {
    console.error("InitDB Error:", err);
    res.status(500).json({ error: "Database initialization failed" });
  } finally {
    client.release();
  }
}

