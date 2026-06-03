"use client";

import { useState } from "react";
import { X, Check, Lock } from "lucide-react";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
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

const PRICE: Record<Tier, Record<Cycle, { price: string; cycle: string; sub: string; equiv?: string }>> = {
  pro: {
    monthly: { price: "$14.99", cycle: "/month", sub: "cancel anytime" },
    annual:  { price: "$99",    cycle: "/year",  sub: "save $80.88 vs monthly", equiv: "~$8.25/mo" },
  },
  pro_plus: {
    monthly: { price: "$29.99", cycle: "/month", sub: "for heavy streamers" },
    annual:  { price: "$299",   cycle: "/year",  sub: "save $60.88 vs monthly", equiv: "~$24.92/mo" },
  },
};

const FEATURES: Record<Tier, string[]> = {
  pro: [
    "15 VOD analyses / month",
    "20 hours of analysis / month",
    "Streams up to 8 hours each",
    "20 clips per month",
    "Post to YouTube Shorts",
  ],
  pro_plus: [
    "35 VOD analyses / month",
    "50 hours of analysis / month",
    "Streams up to 10 hours each",
    "35 clips per month",
    "Priority processing",
    "Everything in Pro",
  ],
};

function StripeBadge() {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
      padding: "7px 14px", borderRadius: 8,
      background: "color-mix(in oklab, var(--surface-2) 80%, transparent)",
      border: "1px solid var(--line)",
    }}>
      <Lock size={11} style={{ color: "var(--ink-3)", flexShrink: 0 }} />
      <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>Secured by</span>
      <span style={{
        fontSize: 13, fontWeight: 700, letterSpacing: "-0.02em",
        color: "#635BFF", fontFamily: "system-ui, sans-serif",
      }}>stripe</span>
    </div>
  );
}

export function UpgradeModal({ isOpen, onClose, reason, initialTier = "pro" }: UpgradeModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tier, setTier] = useState<Tier>(initialTier);
  const [cycle, setCycle] = useState<Cycle>("monthly");

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

  const details = PRICE[tier][cycle];
  const isProPlus = tier === "pro_plus";
  const tierAccent = isProPlus ? "rgb(255,88,0)" : "var(--blue)";
  const tierAccentSoft = isProPlus
    ? "rgba(255,88,0,0.12)"
    : "color-mix(in oklab, var(--blue-soft) 30%, var(--surface-2))";
  const tierAccentBorder = isProPlus
    ? "rgba(255,88,0,0.35)"
    : "color-mix(in oklab, var(--blue) 30%, var(--line))";

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16, backgroundColor: "rgba(0,0,0,0.75)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--line-2)",
        borderRadius: 20,
        width: "100%",
        maxWidth: 460,
        boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 24px 0",
        }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: tierAccent, margin: 0 }}>
              {isProPlus ? "Pro Plus" : "Pro"}
            </p>
            <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", margin: "2px 0 0", color: "var(--ink)" }}>
              Upgrade to {isProPlus ? "Pro Plus" : "Pro"}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "1px solid var(--line)", borderRadius: 8,
              color: "var(--ink-3)", cursor: "pointer", padding: "5px 6px",
              display: "flex", alignItems: "center",
            }}
          >
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: "16px 24px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ fontSize: 13, color: "var(--ink-3)", margin: 0 }}>{reason}</p>

          {/* Tier picker */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
            background: "var(--surface-2)", borderRadius: 10, padding: 4,
            border: "1px solid var(--line)",
          }}>
            {(["pro", "pro_plus"] as const).map((t) => {
              const active = tier === t;
              const label = t === "pro_plus" ? "Pro Plus" : "Pro";
              return (
                <button
                  key={t}
                  onClick={() => setTier(t)}
                  style={{
                    padding: "9px 12px", borderRadius: 7, border: "none",
                    background: active ? "var(--surface)" : "transparent",
                    color: active ? "var(--ink)" : "var(--ink-3)",
                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                    boxShadow: active ? "0 1px 3px rgba(0,0,0,0.2)" : "none",
                    transition: "all 120ms",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Cycle picker */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
            background: "var(--surface-2)", borderRadius: 10, padding: 4,
            border: "1px solid var(--line)",
          }}>
            {(["monthly", "annual"] as const).map((c) => {
              const active = cycle === c;
              return (
                <button
                  key={c}
                  onClick={() => setCycle(c)}
                  style={{
                    position: "relative",
                    padding: "9px 12px", borderRadius: 7, border: "none",
                    background: active ? "var(--surface)" : "transparent",
                    color: active ? "var(--ink)" : "var(--ink-3)",
                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                    boxShadow: active ? "0 1px 3px rgba(0,0,0,0.2)" : "none",
                    textTransform: "capitalize",
                    transition: "all 120ms",
                  }}
                >
                  {c}
                  {c === "annual" && (
                    <span style={{
                      position: "absolute", top: -7, right: -4,
                      fontSize: 9, fontWeight: 700, letterSpacing: "0.05em",
                      padding: "2px 6px", borderRadius: 4,
                      background: "var(--green)", color: "#0b1c10",
                    }}>SAVE 17%</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Price block */}
          <div style={{
            background: tierAccentSoft,
            border: `1px solid ${tierAccentBorder}`,
            borderRadius: 12, padding: "14px 16px",
          }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--ink)" }}>{details.price}</span>
              <span style={{ fontSize: 13, color: "var(--ink-3)" }}>{details.cycle} · {details.sub}</span>
            </div>
            {details.equiv && (
              <p style={{ fontSize: 11, color: "var(--green)", margin: "4px 0 0", fontWeight: 600 }}>
                {details.equiv}
              </p>
            )}
          </div>

          {/* Features (adapt to tier) */}
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 9 }}>
            {FEATURES[tier].map((f) => (
              <li key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "var(--ink-2)" }}>
                <span style={{
                  flexShrink: 0, width: 18, height: 18, borderRadius: "50%",
                  background: "color-mix(in oklab, var(--green-soft) 60%, transparent)",
                  border: "1px solid color-mix(in oklab, var(--green) 35%, var(--line))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Check size={10} style={{ color: "var(--green)" }} />
                </span>
                {f}
              </li>
            ))}
          </ul>

          {error && (
            <p style={{ fontSize: 12, color: "var(--danger, #f87171)", textAlign: "center", margin: 0 }}>{error}</p>
          )}

          {/* CTA */}
          <button
            onClick={handleUpgrade}
            disabled={loading}
            style={{
              width: "100%",
              background: loading
                ? "var(--surface-3)"
                : isProPlus
                ? "linear-gradient(135deg, rgb(255,88,0), rgb(242,97,121))"
                : "linear-gradient(135deg, var(--blue), var(--green))",
              color: "#fff",
              fontSize: 14, fontWeight: 700,
              padding: "13px 20px",
              borderRadius: 12, border: "none", cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              transition: "opacity 150ms",
              boxShadow: loading
                ? "none"
                : isProPlus
                ? "0 6px 20px -6px rgba(255,88,0,0.5)"
                : "0 6px 20px -6px color-mix(in oklab, var(--blue) 60%, transparent)",
            }}
          >
            {loading
              ? "Redirecting to checkout..."
              : `Upgrade to ${isProPlus ? "Pro Plus" : "Pro"}: ${details.price}${details.cycle}`}
          </button>

          {/* Stripe badge */}
          <StripeBadge />
        </div>
      </div>
    </div>
  );
}
