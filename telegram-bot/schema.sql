
CREATE TABLE IF NOT EXISTS registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL,
  telegram_user_id TEXT NOT NULL,
  telegram_username TEXT,
  email TEXT,
  wallet_address TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id TEXT,               -- Telegram group chat ID
  name TEXT,                   -- Event name
  datetime TEXT,               -- Optional
  min_attendees INTEGER DEFAULT 20,
  max_attendees INTEGER DEFAULT 40,
  is_confirmed INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);




