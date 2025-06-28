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
    created_at INTEGER NOT NULL, -- unix time (seconds)
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until INTEGER, -- unix time (seconds) when account unlocks
    email_verified INTEGER NOT NULL DEFAULT 0 -- 0 = unverified, 1 = verified
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

-- Password reset tokens table - stores temporary reset tokens
CREATE TABLE IF NOT EXISTS {PREFIX}_password_reset_tokens (
    token TEXT NOT NULL PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL, -- unix time (seconds)
    expires_at INTEGER NOT NULL, -- unix time (seconds)
    used_at INTEGER, -- unix time (seconds) when token was used
    FOREIGN KEY (user_id) REFERENCES {PREFIX}_users(id) ON DELETE CASCADE
) STRICT;

-- Email verification tokens table - stores temporary verification tokens
CREATE TABLE IF NOT EXISTS {PREFIX}_email_verification_tokens (
    token TEXT NOT NULL PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL, -- unix time (seconds)
    expires_at INTEGER NOT NULL, -- unix time (seconds)
    used_at INTEGER, -- unix time (seconds) when token was used
    FOREIGN KEY (user_id) REFERENCES {PREFIX}_users(id) ON DELETE CASCADE
) STRICT;

-- CSRF tokens table - stores one-time use CSRF tokens for form protection
CREATE TABLE IF NOT EXISTS {PREFIX}_csrf_tokens (
    token TEXT NOT NULL PRIMARY KEY,
    created_at INTEGER NOT NULL -- unix time (seconds)
) STRICT;

-- Subscription tables for Stripe Checkout integration

-- Stripe customers table - links users to Stripe customer accounts
CREATE TABLE IF NOT EXISTS {PREFIX}_stripe_customers (
    id TEXT NOT NULL PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    stripe_customer_id TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL, -- unix time (seconds)
    updated_at INTEGER NOT NULL -- unix time (seconds)
) STRICT;

-- Subscriptions table - tracks user subscription status
CREATE TABLE IF NOT EXISTS {PREFIX}_subscriptions (
    id TEXT NOT NULL PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    stripe_subscription_id TEXT,
    status TEXT NOT NULL DEFAULT 'free', -- 'free', 'standard', 'canceled', 'past_due'
    plan_id TEXT,
    current_period_end INTEGER, -- unix time (seconds)
    created_at INTEGER NOT NULL, -- unix time (seconds)
    updated_at INTEGER NOT NULL -- unix time (seconds)
) STRICT;

-- Webhook events table - stores Stripe webhook events for idempotency
CREATE TABLE IF NOT EXISTS {PREFIX}_webhook_events (
    id TEXT NOT NULL PRIMARY KEY,
    stripe_event_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    processed INTEGER NOT NULL DEFAULT 0, -- 0 = false, 1 = true
    created_at INTEGER NOT NULL -- unix time (seconds)
) STRICT;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_{PREFIX}_users_email ON {PREFIX}_users(email);
CREATE INDEX IF NOT EXISTS idx_{PREFIX}_sessions_created_at ON {PREFIX}_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_{PREFIX}_password_reset_tokens_user_id ON {PREFIX}_password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_{PREFIX}_password_reset_tokens_expires_at ON {PREFIX}_password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_{PREFIX}_email_verification_tokens_user_id ON {PREFIX}_email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_{PREFIX}_email_verification_tokens_expires_at ON {PREFIX}_email_verification_tokens(expires_at);

-- Subscription-related indexes
CREATE INDEX IF NOT EXISTS idx_{PREFIX}_stripe_customers_user_id ON {PREFIX}_stripe_customers(user_id);
CREATE INDEX IF NOT EXISTS idx_{PREFIX}_subscriptions_user_id ON {PREFIX}_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_{PREFIX}_subscriptions_status ON {PREFIX}_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_{PREFIX}_webhook_events_stripe_event_id ON {PREFIX}_webhook_events(stripe_event_id);

-- Rate limiting table for token bucket implementation
CREATE TABLE IF NOT EXISTS {PREFIX}_rate_limits (
    key TEXT NOT NULL PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0,
    refilled_at_ms INTEGER NOT NULL,
    created_at INTEGER NOT NULL
) STRICT;

-- Index for rate limiting cleanup
CREATE INDEX IF NOT EXISTS idx_{PREFIX}_rate_limits_created_at ON {PREFIX}_rate_limits(created_at);