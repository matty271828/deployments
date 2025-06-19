-- Authentication Service Database Schema Template
-- This schema will be processed during deployment to add domain prefixes
-- Template variables: {PREFIX} will be replaced with the repo name
-- Following Lucia's recommendations for secure session implementation

-- Users table - stores user information
CREATE TABLE IF NOT EXISTS {PREFIX}_users (
    id TEXT NOT NULL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at INTEGER NOT NULL -- unix time (seconds)
) STRICT;

-- Sessions table - stores secure session data
-- Following Lucia's recommendations: id + secret_hash + created_at
CREATE TABLE IF NOT EXISTS {PREFIX}_sessions (
    id TEXT NOT NULL PRIMARY KEY,
    user_id TEXT NOT NULL,
    secret_hash BLOB NOT NULL, -- blob is a SQLite data type for raw binary
    created_at INTEGER NOT NULL, -- unix time (seconds)
    FOREIGN KEY (user_id) REFERENCES {PREFIX}_users(id) ON DELETE CASCADE
) STRICT;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_{PREFIX}_users_email ON {PREFIX}_users(email);
CREATE INDEX IF NOT EXISTS idx_{PREFIX}_sessions_created_at ON {PREFIX}_sessions(created_at); 