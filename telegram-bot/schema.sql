-- Events table
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  group_id TEXT,
  name TEXT,
  city TEXT,  -- ✅ Used for city-based filtering
  datetime TIMESTAMPTZ,
  min_attendees INTEGER DEFAULT 1,
  max_attendees INTEGER DEFAULT 40,
  is_confirmed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Registrations table
CREATE TABLE IF NOT EXISTS registrations (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id),
  telegram_user_id TEXT NOT NULL,
  telegram_username TEXT,
  email TEXT,
  wallet_address TEXT,
  timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (event_id, telegram_user_id)
);

-- Invitations table
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

-- ✅ Email subscribers for confirmed event alerts
CREATE TABLE IF NOT EXISTS user_emails (
  telegram_user_id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  subscribed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ✅ Optional performance index
CREATE INDEX IF NOT EXISTS idx_events_city ON events(LOWER(city));

