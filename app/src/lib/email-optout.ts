import { createHmac, timingSafeEqual } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Turning off emails about your streams (migration 037).
 *
 * Each email carries a link signed for its reader, so it works without
 * signing in and can't be used to switch someone else's emails off. The
 * key is EMAIL_LINK_SECRET when set, else the service role key: both are
 * server-only, and an HMAC doesn't reveal the key it was made with.
 */

const SITE = "https://levlcast.com";

function key(): string | null {
  return process.env.EMAIL_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || null;
}

function sign(userId: string): string | null {
  const k = key();
  if (!k) return null;
  return createHmac("sha256", k).update(`email-opt-out:${userId}`).digest("base64url").slice(0, 32);
}

export function verifyOptOutLink(userId: string, token: string): boolean {
  const expected = sign(userId);
  if (!expected || token.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

/**
 * The reader's own links: a page that asks first (so a mail scanner
 * opening the link can't unsubscribe anyone), and the one-click address
 * mail apps POST to from their own Unsubscribe button.
 */
export function optOutLinks(userId: string): { page: string; oneClick: string } | null {
  const t = sign(userId);
  if (!t) return null;
  const q = `u=${encodeURIComponent(userId)}&t=${t}`;
  return { page: `${SITE}/unsubscribe?${q}`, oneClick: `${SITE}/api/email/unsubscribe?${q}` };
}

/**
 * Whether they've turned these emails off. A read on its own, and false
 * on any error, so the emails keep working before migration 037 is run.
 */
export async function emailsOff(client: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await client.from("profiles").select("email_opt_out").eq("id", userId).maybeSingle();
  if (error) return false;
  return (data as { email_opt_out?: boolean } | null)?.email_opt_out === true;
}
