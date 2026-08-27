-- ============================================================
-- LevlCast — Add unique constraint on subscriptions.user_id
-- Required for upsert({ onConflict: "user_id" }) to work correctly.
-- Without this, each activation inserts a new row instead of updating.
-- ============================================================

ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_user_id_key UNIQUE (user_id);
