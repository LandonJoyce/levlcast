-- ============================================================
-- LevlCast — Subscription Expiry
-- Stores when pro access expires so we can downgrade users
-- automatically if PayPal billing lapses.
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;
