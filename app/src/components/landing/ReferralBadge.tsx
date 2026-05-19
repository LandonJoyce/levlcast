"use client";

import { useEffect, useState } from "react";

const COOKIE_NAME = "lc_promo";

/** Read a cookie by name from document.cookie. */
function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

/**
 * Small "20% off applied via CODE" badge shown when a visitor lands via
 * a /r/[code] partner link. Reads the lc_promo cookie + a ?ref= query
 * fallback. Confirms to the visitor that the discount is active before
 * they hit Stripe checkout (otherwise the discount would silently apply
 * with no visual cue, and viewers would assume the partner link broke).
 *
 * Renders nothing when no referral is active. Hidden state is fine —
 * we don't want to pollute the hero for organic traffic.
 */
export default function ReferralBadge() {
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    // Prefer the cookie since it's the source of truth for the checkout
    // session. Fall back to ?ref= for the immediate-arrival case where
    // the cookie hasn't been read yet (it's set by the same redirect).
    const fromCookie = readCookie(COOKIE_NAME);
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("ref");
    const resolved = fromCookie || fromQuery;
    if (resolved && /^[A-Z0-9_-]{3,40}$/.test(resolved)) {
      setCode(resolved);
    }
  }, []);

  if (!code) return null;

  // Surface the discount percent if the code contains a number suffix
  // (CHRYSTA20 → 20% off). Otherwise show a generic "Discount applied".
  // Most partner codes follow the {HANDLE}{PERCENT} pattern, so this
  // resolves cleanly for the common case without an extra DB lookup.
  const match = code.match(/(\d{1,2})$/);
  const pct = match ? `${match[1]}% off` : "Discount applied";

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        borderRadius: 999,
        background: "rgba(163,230,53,0.12)",
        border: "1px solid rgba(163,230,53,0.4)",
        color: "#A3E635",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.04em",
        marginBottom: 14,
        fontFamily: '"Helvetica Neue", "Helvetica", "Arial", system-ui, sans-serif',
      }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <span>{pct} applied via {code}</span>
    </div>
  );
}
