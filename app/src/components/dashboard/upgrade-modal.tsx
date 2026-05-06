"use client";

import { useState } from "react";
import { X, Check, Lock } from "lucide-react";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason: string;
}

type Plan = "monthly" | "annual";

const FEATURES = [
  "15 VOD analyses per month",
  "20 clip generations per month",
  "Full coaching report on every stream",
  "Priority processing",
];

const PLAN_DETAILS: Record<Plan, { price: string; cycle: string; sub: string; badge?: string }> = {
  monthly: { price: "$9.99", cycle: "/month", sub: "cancel anytime" },
  annual:  { price: "$99",   cycle: "/year",  sub: "save $20.88 vs monthly", badge: "Save 17%" },
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

export function UpgradeModal({ isOpen, onClose, reason }: UpgradeModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan>("monthly");

  async function handleUpgrade() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
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

  const details = PLAN_DETAILS[plan];

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
        maxWidth: 420,
        boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 24px 0",
        }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--blue)", margin: 0 }}>
              Pro
            </p>
            <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", margin: "2px 0 0", color: "var(--ink)" }}>
              Upgrade to Pro
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

        <div style={{ padding: "16px 24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ fontSize: 13, color: "var(--ink-3)", margin: 0 }}>{reason}</p>

          {/* Plan toggle */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
            background: "var(--surface-2)", borderRadius: 10, padding: 4,
            border: "1px solid var(--line)",
          }}>
            {(["monthly", "annual"] as const).map((p) => {
              const active = plan === p;
              return (
                <button
                  key={p}
                  onClick={() => setPlan(p)}
                  style={{
                    position: "relative",
                    padding: "9px 12px",
                    borderRadius: 7,
                    border: "none",
                    background: active ? "var(--surface)" : "transparent",
                    color: active ? "var(--ink)" : "var(--ink-3)",
                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                    boxShadow: active ? "0 1px 3px rgba(0,0,0,0.2)" : "none",
                    textTransform: "capitalize",
                    transition: "all 120ms",
                  }}
                >
                  {p}
                  {p === "annual" && (
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
            background: "color-mix(in oklab, var(--blue-soft) 30%, var(--surface-2))",
            border: "1px solid color-mix(in oklab, var(--blue) 30%, var(--line))",
            borderRadius: 12, padding: "14px 16px",
          }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--ink)" }}>{details.price}</span>
              <span style={{ fontSize: 13, color: "var(--ink-3)" }}>{details.cycle} · {details.sub}</span>
            </div>
          </div>

          {/* Features */}
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 9 }}>
            {FEATURES.map((f) => (
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
              background: loading ? "var(--surface-3)" : "linear-gradient(135deg, var(--blue), var(--green))",
              color: "#fff",
              fontSize: 14, fontWeight: 700,
              padding: "13px 20px",
              borderRadius: 12, border: "none", cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              transition: "opacity 150ms",
              boxShadow: loading ? "none" : "0 6px 20px -6px color-mix(in oklab, var(--blue) 60%, transparent)",
            }}
          >
            {loading ? "Redirecting to checkout..." : `Upgrade to Pro: ${details.price}${details.cycle}`}
          </button>

          {/* Stripe badge */}
          <StripeBadge />
        </div>
      </div>
    </div>
  );
}
