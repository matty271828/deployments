-- Authentication Service Database Schema Template
-- This schema will be processed during deployment to add domain prefixes
-- Template variables: {PREFIX} will be replaced with the repo name

-- Users table - stores user information
CREATE TABLE IF NOT EXISTS {PREFIX}_users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(email)
);

-- Sessions table - stores active user sessions
CREATE TABLE IF NOT EXISTS {PREFIX}_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES {PREFIX}_users(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_{PREFIX}_users_email ON {PREFIX}_users(email);
CREATE INDEX IF NOT EXISTS idx_{PREFIX}_sessions_user_id ON {PREFIX}_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_{PREFIX}_sessions_expires_at ON {PREFIX}_sessions(expires_at);

-- Create a view for active sessions
CREATE VIEW IF NOT EXISTS {PREFIX}_active_sessions AS
SELECT 
    s.id as session_id,
    s.user_id,
    s.expires_at,
    u.email,
    u.created_at as user_created_at
FROM {PREFIX}_sessions s
JOIN {PREFIX}_users u ON s.user_id = u.id
WHERE s.expires_at > CURRENT_TIMESTAMP; 