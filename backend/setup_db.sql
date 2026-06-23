CREATE TABLE IF NOT EXISTS organizations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    plan VARCHAR(50) NOT NULL DEFAULT 'team',   -- 'team' / 'business' / 'enterprise'
    seats_purchased INTEGER NOT NULL DEFAULT 5,
    owner_user_id INTEGER,                       -- set after first user is created (chicken-and-egg with users table)
    datasets_uploaded_this_month INTEGER DEFAULT 0,
    usage_reset_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY, email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL, password VARCHAR(255),
    plan VARCHAR(50) DEFAULT 'free', created_at TIMESTAMP DEFAULT NOW(),
    is_student BOOLEAN DEFAULT FALSE,
    student_verified BOOLEAN DEFAULT FALSE,   -- true if matched via .edu/.ac.in domain, false if self-declared
    daily_tokens_used INTEGER DEFAULT 0,
    daily_tokens_reset_at TIMESTAMP DEFAULT NOW(),
    datasets_uploaded_this_month INTEGER DEFAULT 0,   -- used for individual Free/Basic/Pro plan limits
    usage_reset_at TIMESTAMP DEFAULT NOW(),
    organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
    org_role VARCHAR(20) DEFAULT NULL,    -- 'admin' / 'member' — only meaningful when organization_id is set
    google_id VARCHAR(255) UNIQUE          -- set when the user signed up/logged in via Google OAuth; password is NULL for Google-only accounts
);
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_org_owner'
    ) THEN
        ALTER TABLE organizations ADD CONSTRAINT fk_org_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Safe migration for databases created before Google OAuth support was added.
-- If the users table already existed without these, add them now; existing
-- rows are unaffected since google_id defaults to NULL and password stays
-- as-is (only newly nullable, not changed).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='users' AND column_name='google_id'
    ) THEN
        ALTER TABLE users ADD COLUMN google_id VARCHAR(255) UNIQUE;
    END IF;
    ALTER TABLE users ALTER COLUMN password DROP NOT NULL;
END $$;
CREATE TABLE IF NOT EXISTS datasets (
    id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(255), rows INTEGER, cols INTEGER,
    dataset_type VARCHAR(100), uploaded_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255), charts JSONB, insights JSONB, kpis JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS activity (
    id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(500), created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS query_history (
    id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    query TEXT, result JSONB, created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS scheduled_reports (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    report_name VARCHAR(255) NOT NULL,
    dataset_snapshot JSONB NOT NULL,        -- saved columns+data so it can run without re-upload
    report_format VARCHAR(10) DEFAULT 'pdf', -- pdf / ppt / html
    frequency VARCHAR(20) NOT NULL,          -- once / daily / weekly / monthly
    scheduled_time TIME NOT NULL,            -- time of day to run (HH:MM:SS)
    scheduled_date DATE,                     -- for 'once' or first run reference
    day_of_week INTEGER,                     -- 0-6 for weekly (0=Monday)
    day_of_month INTEGER,                    -- 1-31 for monthly
    is_active BOOLEAN DEFAULT TRUE,
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS annotations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    target_type VARCHAR(50) NOT NULL,   -- 'chart' / 'dataset' / 'report'
    target_ref  VARCHAR(255) NOT NULL,  -- chart title / dataset filename / report name — simple string ref, no FK needed
    author_name VARCHAR(255),
    comment_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS team_invitations (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    invited_email VARCHAR(255) NOT NULL,
    invited_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'pending',   -- pending / accepted / revoked
    invite_token VARCHAR(64) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    accepted_at TIMESTAMP
);
SELECT 'Tables created!' as status;
