"use client";

import { useState } from "react";
import { X, Check, Loader2 } from "lucide-react";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason: string;
}

const FEATURES = [
  "20 VOD analyses per month",
  "20 clip generations per month",
  "Priority processing",
];

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <h2 className="text-lg font-extrabold tracking-tight">Upgrade to Pro</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-foreground transition-colors p-1 rounded-lg hover:bg-white/5"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-5">
          <p className="text-sm text-muted">{reason}</p>

          {/* Price */}
          <div className="bg-accent/10 border border-accent/20 rounded-xl p-4">
            <p className="text-2xl font-extrabold text-accent-light">
              $9.99
              <span className="text-sm font-normal text-muted ml-1">/month</span>
            </p>
            <p className="text-xs text-muted mt-1">Cancel anytime · Secure checkout via Stripe</p>
          </div>

          {/* Feature list */}
          <ul className="space-y-2">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-2.5 text-sm">
                <span className="flex-shrink-0 w-4 h-4 rounded-full bg-accent/20 flex items-center justify-center">
                  <Check size={10} className="text-accent-light" />
                </span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          {error && (
            <p className="text-xs text-red-400 text-center">{error}</p>
          )}

          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full bg-accent hover:opacity-85 disabled:opacity-50 text-white text-sm font-semibold px-4 py-3 rounded-xl transition-opacity flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            {loading ? "Redirecting to checkout..." : "Upgrade to Pro — $9.99/month"}
          </button>
        </div>
      </div>
    </div>
  );
}
