-- ============================================================
-- LevlCast — PayPal Subscription Columns
-- Run this in Supabase SQL Editor after 001_initial_schema.sql
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS paypal_subscription_id TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS paypal_subscription_id TEXT;
