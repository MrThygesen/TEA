
-- =========================
-- TEA EVENTS FULL SCHEMA
-- =========================

-- ----------------------------
-- WEB USER PROFILES
-- ----------------------------
CREATE TABLE IF NOT EXISTS telegram_user_profiles (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    password_hash TEXT,
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- WEB EMAIL VERIFICATION TOKENS
CREATE TABLE IF NOT EXISTS web_email_verification_tokens (
    token TEXT PRIMARY KEY,
    user_id INTEGER REFERENCES telegram_user_profiles(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_web_email_verif_userid
    ON web_email_verification_tokens(user_id);

-- ----------------------------
-- USER PROFILES
-- ----------------------------
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

-- EMAIL VERIFICATION TOKENS
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    token TEXT PRIMARY KEY,
    user_id INTEGER REFERENCES user_profiles(id) ON DELETE CASCADE,
    telegram_user_id INTEGER REFERENCES telegram_user_profiles(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT email_verif_user_or_telegram CHECK (
    user_id IS NOT NULL OR telegram_user_id IS NOT NULL
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_verif_userid
    ON email_verification_tokens(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_verif_tgid
    ON email_verification_tokens(telegram_user_id);

-- ----------------------------
-- EVENTS
-- ----------------------------
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

CREATE INDEX IF NOT EXISTS idx_events_city
    ON events(LOWER(city));

-- ----------------------------
-- REGISTRATIONS
-- ----------------------------
CREATE TABLE IF NOT EXISTS registrations (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    telegram_user_id INTEGER NOT NULL REFERENCES telegram_user_profiles(id) ON DELETE CASCADE,
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
    CONSTRAINT registrations_user_check CHECK (
    user_id IS NOT NULL OR telegram_user_id IS NOT NULL
    ),
    UNIQUE(event_id, user_id, telegram_user_id)
);

-- ----------------------------
-- INVITATIONS
-- ----------------------------
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

-- ----------------------------
-- USER EMAILS
-- ----------------------------
CREATE TABLE IF NOT EXISTS user_emails (
    user_id INTEGER PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    subscribed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);



-- =========================
-- FAVORITES (hearts)
-- supports both user types
-- =========================
CREATE TABLE IF NOT EXISTS favorites (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES user_profiles(id) ON DELETE CASCADE,
    telegram_user_id INTEGER REFERENCES telegram_user_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT favorites_user_check CHECK (
        user_id IS NOT NULL OR telegram_user_id IS NOT NULL
    ),
    UNIQUE(event_id, user_id, telegram_user_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_event ON favorites(event_id);
CREATE INDEX IF NOT EXISTS idx_favorites_web ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_tg ON favorites(telegram_user_id);


-- ----------------------------
-- TRIGGER FUNCTION FOR updated_at
-- ----------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- ----------------------------
-- ATTACH TRIGGERS
-- ----------------------------
DROP TRIGGER IF EXISTS trg_update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER trg_update_user_profiles_updated_at
BEFORE UPDATE ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_events_updated_at ON events;
CREATE TRIGGER trg_update_events_updated_at
BEFORE UPDATE ON events
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------
-- Optional: Add triggers for user_profiles
-- ----------------------------
DROP TRIGGER IF EXISTS trg_update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER trg_update_user_profiles_updated_at
BEFORE UPDATE ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

