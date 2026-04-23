-- 018_protect_subscription_columns.sql
-- Prevents authenticated users from modifying their own subscription state
-- directly through the Supabase client. Without this, any signed-in user
-- could run:
--   supabase.from('profiles').update({ plan: 'pro', subscription_expires_at: '...' })
-- and grant themselves Pro access for free, because the existing RLS policy
-- "Users update own profile" allows any UPDATE on their own row.
--
-- The trigger fires BEFORE UPDATE. If the request is coming from an
-- authenticated end user (auth.role() = 'authenticated'), any attempt to
-- change plan, subscription_expires_at, or paypal_subscription_id is rejected.
--
-- The service_role key (used by /api/webhooks/* and /api/subscription/* via
-- createAdminClient) bypasses this check because auth.role() returns
-- 'service_role' in that context. Legitimate subscription changes continue
-- to work normally.

CREATE OR REPLACE FUNCTION protect_profile_subscription_columns()
RETURNS trigger AS $$
BEGIN
  IF auth.role() = 'authenticated' THEN
    IF NEW.plan IS DISTINCT FROM OLD.plan
       OR NEW.subscription_expires_at IS DISTINCT FROM OLD.subscription_expires_at
       OR NEW.paypal_subscription_id IS DISTINCT FROM OLD.paypal_subscription_id THEN
      RAISE EXCEPTION 'Subscription columns can only be modified by the server';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_profile_subscription_columns_trigger ON profiles;

CREATE TRIGGER protect_profile_subscription_columns_trigger
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_profile_subscription_columns();
