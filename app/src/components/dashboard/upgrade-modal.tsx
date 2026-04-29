"use client";

import { useState } from "react";
import { X, Check, Lock } from "lucide-react";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason: string;
}

const FEATURES = [
  "20 VOD analyses per month",
  "20 clip generations per month",
  "Full coaching report on every stream",
  "Priority processing",
];

function StripeBadge() {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      padding: "7px 14px",
      borderRadius: 8,
      background: "color-mix(in oklab, var(--surface-2) 80%, transparent)",
      border: "1px solid var(--line)",
    }}>
      <Lock size={11} style={{ color: "var(--ink-3)", flexShrink: 0 }} />
      <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>Secured by</span>
      {/* Stripe wordmark */}
      <svg width="34" height="14" viewBox="0 0 60 25" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <path d="M59.64 14.28c0-4.71-2.28-8.43-6.63-8.43-4.37 0-7.02 3.72-7.02 8.4 0 5.54 3.13 8.34 7.62 8.34 2.19 0 3.84-.5 5.09-1.19v-3.68c-1.25.62-2.69.98-4.51.98-1.79 0-3.37-.62-3.57-2.78h8.99c0-.24.03-.95.03-1.64zm-9.09-1.75c0-2.06 1.26-2.93 2.4-2.93 1.11 0 2.3.87 2.3 2.93h-4.7zm-9.98-6.68c-1.8 0-2.95.85-3.59 1.43l-.24-1.14H33v21.31l4.27-.91.01-5.17c.66.48 1.63 1.16 3.24 1.16 3.27 0 6.25-2.63 6.25-8.44-.01-5.31-3.03-8.24-6.2-8.24zm-1.09 12.68c-1.08 0-1.71-.38-2.15-.85l-.02-6.72c.48-.53 1.13-.9 2.17-.9 1.66 0 2.8 1.86 2.8 4.22 0 2.42-1.12 4.25-2.8 4.25zM28.3 5.03l4.27-.92V.77l-4.27.91v3.35zm0 1.44h4.27v16.26H28.3V6.47zm-4.65 1.38-.27-1.38h-3.68v16.26h4.26V11.7c1.01-1.31 2.72-1.07 3.24-.9V6.47c-.54-.19-2.51-.54-3.55 1.38zm-9.46-4.82L9.97 3.94l-.01 13.38c0 2.47 1.85 4.29 4.32 4.29 1.37 0 2.37-.25 2.92-.55v-3.46c-.53.21-3.17 1-3.17-1.48v-6.6h3.17V6.47h-3.17L13.19 3.03zM3.81 11.5c0-.66.55-.92 1.46-.92.96 0 2.16.29 3.12.8V7.41A8.3 8.3 0 004.98 6.7C2.06 6.7 0 8.19 0 11.66c0 5.42 7.46 4.56 7.46 6.9 0 .78-.68 1.04-1.63 1.04-1.41 0-3.22-.58-4.65-1.37v4.03c1.58.68 3.18.97 4.65.97 3.54 0 5.97-1.75 5.97-5.26C11.8 12.55 3.81 13.6 3.81 11.5z" fill="var(--ink-2)"/>
      </svg>
    </div>
  );
}

export function UpgradeModal({ isOpen, onClose, reason }: UpgradeModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
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
              Founding Member
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

          {/* Price block */}
          <div style={{
            background: "color-mix(in oklab, var(--blue-soft) 30%, var(--surface-2))",
            border: "1px solid color-mix(in oklab, var(--blue) 30%, var(--line))",
            borderRadius: 12, padding: "14px 16px",
            display: "flex", alignItems: "baseline", gap: 6,
          }}>
            <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--ink)" }}>$9.99</span>
            <span style={{ fontSize: 13, color: "var(--ink-3)" }}>/month · cancel anytime</span>
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
            {loading ? "Redirecting to checkout..." : "Upgrade to Pro — $9.99/month"}
          </button>

          {/* Stripe badge */}
          <StripeBadge />
        </div>
      </div>
    </div>
  );
}
