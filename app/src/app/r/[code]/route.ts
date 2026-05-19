/**
 * GET /r/[code]
 *
 * Partner referral entry point. A streamer drops levlcast.com/r/CHRYSTA20
 * in their bio / overlay / Discord. The viewer clicks, we set a cookie
 * with the promo code, and redirect them to the landing page. From that
 * point on until cookie expiry the code is auto-applied:
 *   - Landing shows a "20% off applied via CHRYSTA20" badge
 *   - /api/stripe/checkout reads the cookie and pre-applies the Stripe
 *     promotion code on the checkout session, so the viewer doesn't have
 *     to type anything to get their discount.
 *
 * The cookie is set with a 30-day expiry so a viewer who decides to
 * upgrade a week later still gets the partner's attribution.
 *
 * Codes are normalized to uppercase. Unknown / invalid codes are still
 * accepted and stored — Stripe will simply ignore them if no matching
 * promotion code exists when checkout fires.
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const REFERRAL_COOKIE = "lc_promo";
/** 30 days in seconds. Matches typical affiliate-attribution windows. */
const REFERRAL_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;
/** Defensive: reject obviously garbage codes so we don't store junk. */
const CODE_PATTERN = /^[A-Z0-9_-]{3,40}$/;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const normalized = (code || "").trim().toUpperCase();

  const origin = new URL(request.url).origin;
  const redirectUrl = new URL("/", origin);

  // Pass the code on the redirect as a query param so the client-side
  // landing component can pop a "discount applied" toast on first arrival
  // (the cookie alone is invisible to the visitor).
  if (CODE_PATTERN.test(normalized)) {
    redirectUrl.searchParams.set("ref", normalized);
  }

  const response = NextResponse.redirect(redirectUrl);

  if (CODE_PATTERN.test(normalized)) {
    response.cookies.set({
      name: REFERRAL_COOKIE,
      value: normalized,
      maxAge: REFERRAL_COOKIE_MAX_AGE,
      path: "/",
      sameSite: "lax",
      // Not httpOnly so the landing client can also read it for the badge.
      // The cookie carries no auth weight — losing/forging it just changes
      // which partner gets attributed, not anything security-sensitive.
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
    });
  }

  return response;
}
