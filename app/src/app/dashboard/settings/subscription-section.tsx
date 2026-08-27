"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { UpgradeModal } from "@/components/dashboard/upgrade-modal";

interface SubscriptionSectionProps {
  plan: "free" | "pro";
  /** True when the user is on the Pro Plus tier ($29.99/mo). */
  proPlus?: boolean;
  analysesUsed: number;
  analysesLimit: number;
  clipsUsed: number;
  clipsLimit: number;
  /** Hours of analysis used / limit this period. 0/0 means no hour cap (free trial). */
  hoursUsed?: number;
  hoursLimit?: number;
  /** "this month" for Pro, "ever" for free trial. */
  periodLabel: string;
  /** True when the user is on the lifetime free trial (vs paid free fallback). */
  onTrial: boolean;
  hasStripeSubscription: boolean;
  hasPaypalSubscription: boolean;
  subscriptionExpiresAt: string | null;
  subscriptionStatus: string | null;
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const isPro = limit >= 999;
  const pct = isPro ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const displayLimit = isPro ? "Unlimited" : limit;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="font-semibold tabular-nums">
          {used}<span className="text-muted font-normal"> / {displayLimit}</span>
        </span>
      </div>
      {!isPro && (
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

export function SubscriptionSection({
  plan,
  proPlus = false,
  analysesUsed,
  analysesLimit,
  clipsUsed,
  clipsLimit,
  hoursUsed,
  hoursLimit,
  periodLabel,
  onTrial,
  hasStripeSubscription,
  hasPaypalSubscription,
  subscriptionExpiresAt,
  subscriptionStatus,
}: SubscriptionSectionProps) {
  const isCancelled = plan === "pro" && !hasStripeSubscription && !hasPaypalSubscription && subscriptionStatus === "cancelled";
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  /** Which tier to preselect when opening the upgrade modal. */
  const [upgradeInitialTier, setUpgradeInitialTier] = useState<"pro" | "pro_plus">("pro");
  const planLabel = plan === "pro" ? (proPlus ? "Pro Plus" : "Pro") : onTrial ? "Free trial" : "Free";

  async function openPortal() {
    setPortalLoading(true);
    setPortalError(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.url) {
        setPortalError(json.error || "Could not open subscription portal.");
        return;
      }
      window.location.href = json.url;
    } catch {
      setPortalError("Network error. Please try again.");
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <>
      <div className="bg-surface border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Subscription</h2>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${plan === "pro" ? "bg-accent/20 text-accent-light" : "bg-white/5 text-muted"}`}>
            {planLabel}
          </span>
        </div>

        {/* Usage stats */}
        <div className="space-y-4 mb-6">
          <UsageBar label={`VOD analyses ${periodLabel}`} used={analysesUsed} limit={analysesLimit} />
          <UsageBar label={`Clips generated ${periodLabel}`} used={clipsUsed} limit={clipsLimit} />
          {/* Hours used — only show when the hour cap applies (Pro / Founding / Pro Plus). */}
          {typeof hoursLimit === "number" && hoursLimit > 0 && typeof hoursUsed === "number" && (
            <UsageBar label={`Analysis hours ${periodLabel}`} used={hoursUsed} limit={hoursLimit} />
          )}
        </div>

        {/* Actions */}
        {plan === "free" ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              {onTrial
                ? `Your free trial includes ${analysesLimit} analyses and ${clipsLimit} clips. Subscribe for 15 analyses and 20 clips every month.`
                : "Upgrade to Pro for 15 VOD analyses and 20 clips per month, plus streams up to 8 hours each."}
            </p>
            <button
              onClick={() => { setUpgradeInitialTier("pro"); setUpgradeOpen(true); }}
              className="bg-accent hover:opacity-85 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-opacity"
            >
              Upgrade to Pro $14.99/month
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {isCancelled ? (
              <p className="text-sm text-muted">
                Your subscription is cancelled.
                {subscriptionExpiresAt && (
                  <> Pro access continues until <strong className="text-foreground">{new Date(subscriptionExpiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</strong>.</>
                )}
              </p>
            ) : (
              <>
                <p className="text-sm text-muted">
                  You are on the {proPlus ? "Pro Plus" : "Pro"} plan. Thank you for your support.
                </p>

                {/* Pro → Pro Plus upgrade CTA. Hide for users already on Pro Plus
                    and for non-Stripe subscribers (RevenueCat/PayPal users have
                    to switch tiers in their respective billing portals). */}
                {!proPlus && hasStripeSubscription && (
                  <button
                    onClick={() => { setUpgradeInitialTier("pro_plus"); setUpgradeOpen(true); }}
                    className="text-sm font-semibold px-4 py-2 rounded-lg transition-opacity hover:opacity-85"
                    style={{
                      background: "linear-gradient(135deg, rgb(255,88,0), rgb(242,97,121))",
                      color: "#fff",
                    }}
                  >
                    Upgrade to Pro Plus · $29.99/month
                  </button>
                )}

                {/* Stripe subscribers Customer Portal */}
                {hasStripeSubscription && (
                  <>
                    {portalError && <p className="text-xs text-red-400">{portalError}</p>}
                    <button
                      onClick={openPortal}
                      disabled={portalLoading}
                      className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground disabled:opacity-50 transition-colors underline underline-offset-2"
                    >
                      {portalLoading && <Loader2 size={13} className="animate-spin" />}
                      {portalLoading ? "Opening..." : "Manage subscription"}
                    </button>
                  </>
                )}

                {/* PayPal subscribers manual instructions */}
                {hasPaypalSubscription && !hasStripeSubscription && (
                  <p className="text-sm text-muted">
                    You subscribed via PayPal. To cancel, go to{" "}
                    <strong className="text-foreground">paypal.com → Subscriptions → LevlCast</strong>.
                  </p>
                )}

                {/* Mobile (RevenueCat) subscribers */}
                {!hasStripeSubscription && !hasPaypalSubscription && (
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
        initialTier={upgradeInitialTier}
        reason={
          upgradeInitialTier === "pro_plus"
            ? "Pro Plus bumps you to 35 analyses, 50 hours, and 35 clips per month. Streams up to 10 hours each."
            : "Upgrade to Pro for 15 VOD analyses and 20 clip generations per month."
        }
      />
    </>
  );
}
