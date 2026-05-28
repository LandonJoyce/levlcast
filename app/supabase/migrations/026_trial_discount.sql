-- Trial discount window
--
-- Records when a user's 72-hour first-analysis discount window started.
-- Set once, on the first VOD analysis completion. NULL = never triggered
-- (user has not yet completed a first analysis, e.g. brand new accounts
-- and older accounts that pre-date this feature).
--
-- Window is `started + 72h`, evaluated server-side. Stripe checkout
-- attaches a coupon when within the window. Lapsed window users see
-- standard pricing.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS trial_discount_started_at TIMESTAMPTZ;
