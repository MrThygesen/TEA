-- Registrations table
CREATE TABLE IF NOT EXISTS registrations (
  id SERIAL PRIMARY KEY,
  event_id TEXT NOT NULL,
  telegram_user_id TEXT NOT NULL,
  telegram_username TEXT,
  email TEXT,
  wallet_address TEXT,
  timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  group_id TEXT,
  name TEXT,
  datetime TIMESTAMPTZ,
  min_attendees INTEGER DEFAULT 20,
  max_attendees INTEGER DEFAULT 40,
  is_confirmed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

