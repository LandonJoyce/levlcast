"use client";

import { useEffect, useState } from "react";
import { UpgradeModal } from "@/components/dashboard/upgrade-modal";

/**
 * 72-hour discount countdown shown above the regular TrialBanner after a
 * user's first VOD analysis completes. Server passes the discount window's
 * expiry as `expiresAtIso`; this component ticks once a minute, formats the
 * remaining time, and replaces itself with nothing once the window closes
 * (no full-page refresh needed — the next dashboard nav will re-render the
 * server state anyway).
 *
 * The banner is the primary on-site surface for the discount. The same
 * discount also applies automatically at Stripe checkout via the coupon
 * attached in /api/stripe/checkout, so the user doesn't have to type a code.
 */
export function TrialDiscountBanner({
  expiresAtIso,
  discountedMonthly,
  standardMonthly,
  durationMonths,
  personalizedReason,
}: {
  expiresAtIso: string;
  discountedMonthly: number;
  standardMonthly: number;
  durationMonths: number;
  personalizedReason: string;
}) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const expires = new Date(expiresAtIso).getTime();
  const msLeft = expires - now;
  if (msLeft <= 0) return null;

  const hoursLeft = Math.floor(msLeft / (60 * 60 * 1000));
  const minutesLeft = Math.floor((msLeft % (60 * 60 * 1000)) / (60 * 1000));

  const countdown =
    hoursLeft >= 1
      ? `${hoursLeft}h ${minutesLeft}m left`
      : `${minutesLeft}m left`;

  const urgent = hoursLeft < 6;
  const accent = urgent ? "var(--danger)" : "var(--orange, #d97706)";
  const percentOff = Math.round((1 - discountedMonthly / standardMonthly) * 100);

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "12px 16px",
          marginBottom: 16,
          borderRadius: 12,
          background: `color-mix(in oklab, ${accent} 10%, var(--surface))`,
          border: `1px solid color-mix(in oklab, ${accent} 36%, var(--line))`,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              color: "var(--ink)",
              margin: 0,
              lineHeight: 1.35,
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span>
              {percentOff}% off your first {durationMonths} months. {countdown}.
            </span>
          </p>
          <p
            style={{
              fontSize: 12,
              color: "var(--ink-3)",
              margin: "2px 0 0",
              lineHeight: 1.4,
            }}
          >
            ${discountedMonthly.toFixed(2)}/month for {durationMonths} months, then ${standardMonthly.toFixed(2)}. Window closes when the timer runs out.
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          style={{
            background: accent,
            color: "#fff",
            fontSize: 12.5,
            fontWeight: 700,
            padding: "7px 14px",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Claim ${discountedMonthly.toFixed(2)}/mo
        </button>
      </div>

      <UpgradeModal
        isOpen={open}
        onClose={() => setOpen(false)}
        reason={personalizedReason}
        trialDiscount={{
          expiresAtIso,
          discountedMonthly,
          standardMonthly,
          durationMonths,
        }}
      />
    </>
  );
}
