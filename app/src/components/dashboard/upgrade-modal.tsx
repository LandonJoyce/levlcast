"use client";

import { useEffect, useState } from "react";
import { ArrowRight, X } from "lucide-react";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** One line about why Pro, written from their own streams (lib/upgrade-pitch.ts) or the place it opened from. */
  reason: string;
  /** Pre-select a tier when opening (e.g. from "Upgrade to Pro Plus" CTA). */
  initialTier?: "pro" | "pro_plus";
}

type Tier = "pro" | "pro_plus";
type Cycle = "monthly" | "annual";

/** Stripe checkout plan slug for a tier + cycle combo. */
function planSlug(tier: Tier, cycle: Cycle): string {
  if (tier === "pro_plus") return cycle === "annual" ? "pro_plus_annual" : "pro_plus";
  return cycle === "annual" ? "annual" : "monthly";
}

const PRICE: Record<Tier, Record<Cycle, { price: string; per: string; note: string }>> = {
  pro: {
    monthly: { price: "$20", per: "/month", note: "Cancel anytime." },
    annual: { price: "$199", per: "/year", note: "About two months free." },
  },
  pro_plus: {
    monthly: { price: "$29.99", per: "/month", note: "Cancel anytime." },
    annual: { price: "$299", per: "/year", note: "About two months free." },
  },
};

const FEATURES: Record<Tier, string[]> = {
  pro: [
    "Every stream coached start to finish, up to 8 hours",
    "The coach in OBS listens and tells you what to say",
    "20 streams and 20 clips a month",
    "Clips post straight to YouTube",
  ],
  pro_plus: [
    "Everything in Pro",
    "Streams up to 10 hours",
    "35 streams and 35 clips a month",
  ],
};

/**
 * The Pro checkout popup, opened from the plan button in the top bar and
 * anywhere free runs out. One plan up front with a monthly/yearly switch;
 * Pro Plus is a quiet link for people who stream a lot. It used to open on
 * a paragraph of averages, a Pro/Pro Plus switch, a "SAVE 17%" badge and
 * green check circles, which read as a template.
 */
export function UpgradeModal({ isOpen, onClose, reason, initialTier = "pro" }: UpgradeModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tier, setTier] = useState<Tier>(initialTier);
  const [cycle, setCycle] = useState<Cycle>("monthly");

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  async function handleUpgrade() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planSlug(tier, cycle) }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) {
        setError(json.error || "Something went wrong. Please try again.");
        return;
      }
      window.location.href = json.url;
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  const p = PRICE[tier][cycle];
  const name = tier === "pro_plus" ? "Pro Plus" : "Pro";

  return (
    <div
      className="um"
      role="dialog"
      aria-modal="true"
      aria-labelledby="um-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="um-box">
        <button type="button" className="um-x" onClick={onClose} aria-label="Close">
          <X size={16} strokeWidth={2} aria-hidden="true" />
        </button>

        <p className="um-tier">{name}</p>
        <h2 id="um-title" className="um-h">
          {tier === "pro_plus" ? "For streamers who are live most days." : "Get every stream coached."}
        </h2>
        {reason && tier === "pro" ? <p className="um-why">{reason}</p> : null}

        <div className="um-cycle" role="group" aria-label="Billing">
          {(["monthly", "annual"] as const).map((c) => (
            <button key={c} type="button" aria-pressed={cycle === c} onClick={() => setCycle(c)}>
              {c === "monthly" ? "Monthly" : "Yearly"}
            </button>
          ))}
        </div>

        <p className="um-price">
          {p.price}
          <span>{p.per}</span>
        </p>
        <p className="um-note">{p.note}</p>

        <ul className="um-list">
          {FEATURES[tier].map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>

        {error ? <p className="um-err">{error}</p> : null}

        <button type="button" className="um-go" onClick={handleUpgrade} disabled={loading}>
          {loading ? (
            "Opening checkout…"
          ) : (
            <>
              Get {name} <ArrowRight size={17} strokeWidth={2.2} aria-hidden="true" />
            </>
          )}
        </button>
        <p className="um-fine">Checkout is by Stripe. You can cancel anytime from your account.</p>

        <p className="um-alt">
          {tier === "pro" ? (
            <>
              Live more than 20 times a month?{" "}
              <button type="button" onClick={() => setTier("pro_plus")}>
                See Pro Plus
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setTier("pro")}>
              Back to Pro
            </button>
          )}
        </p>
      </div>
    </div>
  );
}
