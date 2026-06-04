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
 * Title-case a partner handle pulled from the code prefix.
 * "CHRYSTA" -> "Chrysta", "STORM_TV" -> "Storm Tv".
 */
function prettifyHandle(raw: string): string {
  const cleaned = raw.replace(/[_-]+/g, " ").trim().toLowerCase();
  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Big "you arrived via a partner" card shown when a visitor lands through
 * a /r/[code] link. Reads the lc_promo cookie + a ?ref= query fallback,
 * derives the partner name from the code prefix, and shows the resulting
 * discounted monthly price so the visitor sees what they're getting
 * before they hit Stripe checkout.
 *
 * Renders nothing when no referral is active — organic visitors must not
 * see a discount badge they didn't earn.
 *
 * Visual treatment is intentionally bigger than a pill: a partner sending
 * you a deal IS the moment, so the badge gets its own card with the
 * brand gradient. Stays under the H1 width so it doesn't compete with
 * the hero headline.
 */
export default function ReferralBadge() {
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    // Cookie is source of truth (matches what /api/stripe/checkout reads).
    // ?ref= fallback covers the instant after the /r/[code] redirect where
    // the cookie was just set but the client hasn't re-parsed yet.
    const fromCookie = readCookie(COOKIE_NAME);
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("ref");
    const resolved = fromCookie || fromQuery;
    if (resolved && /^[A-Z0-9_-]{3,40}$/.test(resolved)) {
      setCode(resolved);
    }
  }, []);

  if (!code) return null;

  // Pattern: {HANDLE}{PERCENT}. CHRYSTA20 -> Chrysta + 20.
  // Trailing 1-2 digit suffix is the percent. If the code doesn't match,
  // fall back to a generic discount card so we never lie about the math.
  const match = code.match(/^([A-Z][A-Z_-]+?)(\d{1,2})$/);
  const partnerName = match ? prettifyHandle(match[1]) : null;
  const percent = match ? Number(match[2]) : null;

  // Matches the current Pro monthly sticker price. Bumped from $9.99 to
  // $14.99 on 2026-06-03 when the founding deal ended. If this drifts from
  // the actual Stripe price, the badge will lie about the discounted total.
  const STANDARD_MONTHLY = 14.99;
  const discountedMonthly =
    percent !== null
      ? Math.round(STANDARD_MONTHLY * (1 - percent / 100) * 100) / 100
      : null;

  const eyebrow = partnerName ? `${partnerName} sent you` : "Partner referral";
  const stat = percent !== null ? `${percent}% off Pro, forever` : "Discount applied";

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "relative",
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 8,
        padding: "16px 22px 14px",
        marginBottom: 22,
        marginInline: "auto",
        maxWidth: 460,
        borderRadius: 14,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.02) 100%)",
        border: "1px solid rgba(255,255,255,0.08)",
        overflow: "hidden",
        boxShadow:
          "0 0 0 1px rgba(255,88,0,0.08), 0 18px 38px -22px rgba(242,97,121,0.45)",
        fontFamily:
          '"Helvetica Neue", "Helvetica", "Arial", system-ui, sans-serif',
        textAlign: "left",
        animation: "lc-ref-in 420ms cubic-bezier(.22,1,.36,1) both",
      }}
    >
      {/* Top gradient bar — brand accent without dominating */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background:
            "linear-gradient(90deg, rgb(255,88,0), rgb(242,97,121))",
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span
          style={{
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.55)",
          }}
        >
          {eyebrow}
        </span>
        <span
          style={{
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.14em",
            color: "rgba(255,255,255,0.4)",
          }}
        >
          {code}
        </span>
      </div>

      <div
        style={{
          fontFamily:
            '"Instrument Serif", Georgia, "Times New Roman", serif',
          fontWeight: 400,
          fontStyle: "italic",
          fontSize: 28,
          lineHeight: 1.1,
          letterSpacing: "-0.01em",
          background:
            "linear-gradient(90deg, #ffffff 0%, rgb(255,170,120) 60%, rgb(242,97,121) 100%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          WebkitTextFillColor: "transparent",
          color: "transparent",
        }}
      >
        {stat}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        {discountedMonthly !== null ? (
          <>
            <span
              style={{
                fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                fontSize: 18,
                fontWeight: 700,
                color: "#ECF1FA",
                letterSpacing: "-0.01em",
              }}
            >
              ${discountedMonthly.toFixed(2)}
            </span>
            <span
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.55)",
              }}
            >
              /month
            </span>
            <span
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.4)",
                textDecoration: "line-through",
              }}
            >
              ${STANDARD_MONTHLY.toFixed(2)}
            </span>
          </>
        ) : (
          <span
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.55)",
            }}
          >
            Discount auto-applied at checkout
          </span>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 4,
          fontSize: 11.5,
          color: "#A3E635",
          fontWeight: 600,
          letterSpacing: "0.02em",
        }}
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span>Auto-applied when you upgrade. No code to type.</span>
      </div>

      <style>{`
        @keyframes lc-ref-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
