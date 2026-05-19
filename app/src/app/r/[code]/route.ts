/**
 * GET /r/[code]
 *
 * Partner referral entry point. A streamer drops levlcast.com/r/CHRYSTA20
 * in their bio / overlay / Discord. The viewer clicks, we VALIDATE the
 * code against Stripe (active promotion code? matches the literal code
 * text?). Only on validation do we set the attribution cookie and show
 * the success badge — that way nobody can craft `/r/FAKEPARTNER` to
 * fake a discount badge or pollute payout metadata.
 *
 *   Valid code:   set lc_promo cookie → redirect to / with ?ref=CODE
 *   Invalid code: no cookie set        → redirect to / (no badge, no attribution)
 *
 * Cookie is set with a 30-day expiry so a viewer who decides to upgrade
 * a week later still gets the partner's attribution. Cookie value is
 * the validated code text, so /api/stripe/checkout can trust it (it
 * still re-validates as defense-in-depth, but the source-of-truth path
 * is enforced here).
 *
 * Rate-limited by IP to prevent code enumeration. Stripe codes aren't
 * secret but we don't want to burn promotion-code list API calls.
 */

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const REFERRAL_COOKIE = "lc_promo";
/** 30 days in seconds. Matches typical affiliate-attribution windows. */
const REFERRAL_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;
/** Defensive: reject obviously garbage codes so we don't burn Stripe API calls. */
const CODE_PATTERN = /^[A-Z0-9_-]{3,40}$/;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const normalized = (code || "").trim().toUpperCase();

  const origin = new URL(request.url).origin;
  const redirectUrl = new URL("/", origin);

  // Format check first — cheap reject for obvious garbage.
  if (!CODE_PATTERN.test(normalized)) {
    return NextResponse.redirect(redirectUrl);
  }

  // IP-based rate limit to discourage enumeration attacks. 60 hits/hour
  // per IP is more than any honest visitor would generate; bots scanning
  // for valid codes will hit the wall fast.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`referral:${ip}`, 60, 60 * 60 * 1000)) {
    return NextResponse.redirect(redirectUrl);
  }

  // Validate against Stripe. Only active promotion codes that exactly
  // match the code text count. If no match, redirect without setting
  // the cookie — viewer sees the normal landing, no fake discount badge.
  let validated = false;
  try {
    const res = await stripe.promotionCodes.list({
      code: normalized,
      active: true,
      limit: 1,
    });
    validated = (res.data[0]?.code ?? "") === normalized;
  } catch (err) {
    // Stripe transient failure: don't set the cookie (no fake attribution).
    // Log but don't break the redirect — visitor still lands on the site.
    console.warn(
      "[r/code] Stripe validation failed for",
      normalized,
      err instanceof Error ? err.message : err
    );
    return NextResponse.redirect(redirectUrl);
  }

  if (!validated) {
    return NextResponse.redirect(redirectUrl);
  }

  // Validated — set the cookie + show the badge via ?ref query.
  redirectUrl.searchParams.set("ref", normalized);
  const response = NextResponse.redirect(redirectUrl);

  response.cookies.set({
    name: REFERRAL_COOKIE,
    value: normalized,
    maxAge: REFERRAL_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    // Not httpOnly so the landing client can read it for the badge.
    // The cookie carries no auth weight — only attribution metadata.
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
