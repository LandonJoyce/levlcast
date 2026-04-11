"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { UpgradeModal } from "@/components/dashboard/upgrade-modal";

interface SubscriptionSectionProps {
  plan: "free" | "pro";
  analysesUsed: number;
  analysesLimit: number;
  clipsUsed: number;
  clipsLimit: number;
  hasPaypalSubscription: boolean;
  subscriptionExpiresAt: string | null;
  subscriptionStatus: string | null;
}

function UsageBar({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number;
}) {
  const isPro = limit >= 999;
  const pct = isPro ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const displayLimit = isPro ? "Unlimited" : limit;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="font-semibold tabular-nums">
          {used}
          <span className="text-muted font-normal"> / {displayLimit}</span>
        </span>
      </div>
      {!isPro && (
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function SubscriptionSection({
  plan,
  analysesUsed,
  analysesLimit,
  clipsUsed,
  clipsLimit,
  hasPaypalSubscription,
  subscriptionExpiresAt,
  subscriptionStatus,
}: SubscriptionSectionProps) {
  const isCancelled = plan === "pro" && !hasPaypalSubscription && subscriptionStatus === "cancelled";
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  async function handleCancel() {
    if (
      !confirm(
        "Are you sure you want to cancel your Pro subscription? You will keep Pro access until the end of your billing period."
      )
    ) {
      return;
    }

    setCancelling(true);
    setCancelError(null);

    try {
      const res = await fetch("/api/subscription/paypal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });

      const json = await res.json();

      if (!res.ok) {
        setCancelError(json.error || "Cancellation failed");
        return;
      }

      window.location.reload();
    } catch {
      setCancelError("Network error");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <>
      <div className="bg-surface border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
            Subscription
          </h2>
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              plan === "pro"
                ? "bg-accent/20 text-accent-light"
                : "bg-white/5 text-muted"
            }`}
          >
            {plan === "pro" ? "Pro" : "Free"}
          </span>
        </div>

        {/* Usage stats */}
        <div className="space-y-4 mb-6">
          <UsageBar
            label="VOD analyses this month"
            used={analysesUsed}
            limit={analysesLimit}
          />
          <UsageBar
            label="Total clips generated"
            used={clipsUsed}
            limit={clipsLimit}
          />
        </div>

        {/* Actions */}
        {plan === "free" ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              Upgrade to Pro for unlimited analyses, unlimited clips, and
              priority processing.
            </p>
            <button
              onClick={() => setUpgradeOpen(true)}
              className="bg-accent hover:opacity-85 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-opacity"
            >
              Upgrade to Pro — $9.99/month
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {isCancelled ? (
              <>
                <p className="text-sm text-muted">
                  Your subscription is cancelled.
                  {subscriptionExpiresAt && (
                    <> Pro access continues until <strong className="text-foreground">{new Date(subscriptionExpiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</strong>.</>
                  )}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-muted">
                  You are on the Pro plan. Thank you for your support.
                </p>
                {hasPaypalSubscription ? (
                  <>
                    {cancelError && (
                      <p className="text-xs text-red-400">{cancelError}</p>
                    )}
                    <button
                      onClick={handleCancel}
                      disabled={cancelling}
                      className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground disabled:opacity-50 transition-colors underline underline-offset-2"
                    >
                      {cancelling && <Loader2 size={13} className="animate-spin" />}
                      {cancelling ? "Cancelling..." : "Cancel subscription"}
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-muted">
                    You subscribed via the iOS app. To cancel, go to{" "}
                    <strong className="text-foreground">iOS Settings → Apple ID → Subscriptions → LevlCast</strong>.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <UpgradeModal
        isOpen={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        reason="Upgrade to Pro for unlimited VOD analyses and clip generation."
      />
    </>
  );
}
