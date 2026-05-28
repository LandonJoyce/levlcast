/**
 * lib/trial-discount.ts
 *
 * Owns the "72-hour first-analysis discount" conversion mechanic. When a
 * user's first VOD analysis completes, `trial_discount_started_at` is
 * written to their profile. From that timestamp they have 72 hours to
 * upgrade at a discounted price, after which they revert to standard
 * pricing.
 *
 * One-shot: the Inngest pipeline only sets the timestamp if it's null,
 * so churners can't farm the window by deleting their account.
 *
 * The actual Stripe coupon ID lives in env (STRIPE_TRIAL_DISCOUNT_COUPON_ID)
 * and is attached to checkout sessions when `isActive` is true.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** Window length once the timer starts. */
export const TRIAL_DISCOUNT_HOURS = 72;
/** Percent off applied during the window (display + Stripe). */
export const TRIAL_DISCOUNT_PERCENT = 20;
/** Number of monthly cycles the discount repeats for. */
export const TRIAL_DISCOUNT_DURATION_MONTHS = 3;

export interface TrialDiscountStatus {
  /** Whether the window is currently open. */
  isActive: boolean;
  /** ISO string the window opened. Null if never triggered. */
  startedAt: string | null;
  /** ISO string the window closes. Null if never triggered. */
  expiresAt: string | null;
  /** Whole hours remaining, floored. Zero when expired or never started. */
  hoursLeft: number;
  /** Whole minutes remaining inside the current hour. Useful for the last-hour countdown. */
  minutesLeft: number;
  /** Discounted monthly price in dollars (for display). */
  discountedMonthly: number;
  /** Standard monthly price in dollars (for strike-through display). */
  standardMonthly: number;
}

const STANDARD_MONTHLY = 9.99;

/**
 * Compute the current discount status for a user. Pure — does not write.
 * Pass a regular supabase client (RLS is fine, we only read the user's own row).
 */
export async function getTrialDiscountStatus(
  userId: string,
  supabase: SupabaseClient
): Promise<TrialDiscountStatus> {
  const { data } = await supabase
    .from("profiles")
    .select("trial_discount_started_at")
    .eq("id", userId)
    .single();

  return computeStatus((data as { trial_discount_started_at: string | null } | null)?.trial_discount_started_at ?? null);
}

/** Same as above but takes the timestamp directly (for layouts that already loaded the profile). */
export function computeTrialDiscountStatus(startedAtIso: string | null): TrialDiscountStatus {
  return computeStatus(startedAtIso);
}

function computeStatus(startedAtIso: string | null): TrialDiscountStatus {
  const inactive: TrialDiscountStatus = {
    isActive: false,
    startedAt: null,
    expiresAt: null,
    hoursLeft: 0,
    minutesLeft: 0,
    discountedMonthly: Math.round(STANDARD_MONTHLY * (1 - TRIAL_DISCOUNT_PERCENT / 100) * 100) / 100,
    standardMonthly: STANDARD_MONTHLY,
  };

  if (!startedAtIso) return inactive;

  const started = new Date(startedAtIso).getTime();
  if (!Number.isFinite(started)) return inactive;

  const expires = started + TRIAL_DISCOUNT_HOURS * 60 * 60 * 1000;
  const now = Date.now();
  const msLeft = expires - now;

  if (msLeft <= 0) {
    return {
      ...inactive,
      startedAt: startedAtIso,
      expiresAt: new Date(expires).toISOString(),
    };
  }

  const hoursLeft = Math.floor(msLeft / (60 * 60 * 1000));
  const minutesLeft = Math.floor((msLeft % (60 * 60 * 1000)) / (60 * 1000));

  return {
    isActive: true,
    startedAt: startedAtIso,
    expiresAt: new Date(expires).toISOString(),
    hoursLeft,
    minutesLeft,
    discountedMonthly: Math.round(STANDARD_MONTHLY * (1 - TRIAL_DISCOUNT_PERCENT / 100) * 100) / 100,
    standardMonthly: STANDARD_MONTHLY,
  };
}

/**
 * Idempotently start the discount window for a user. Called from the Inngest
 * pipeline when their first VOD analysis completes. Safe to call repeatedly —
 * only writes when the column is still null.
 *
 * Requires an admin client because the Inngest job runs without a user session.
 */
export async function startTrialDiscountIfNeeded(
  userId: string,
  adminSupabase: SupabaseClient
): Promise<void> {
  const { data } = await adminSupabase
    .from("profiles")
    .select("trial_discount_started_at")
    .eq("id", userId)
    .single();

  if ((data as { trial_discount_started_at: string | null } | null)?.trial_discount_started_at) return;

  await adminSupabase
    .from("profiles")
    .update({ trial_discount_started_at: new Date().toISOString() })
    .eq("id", userId)
    .is("trial_discount_started_at", null);
}
