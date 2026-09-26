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
  const unlimited = limit >= 999;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));

  return (
    <div className="ac-use" data-full={!unlimited && pct >= 100 ? "yes" : undefined}>
      <div className="ac-use-line">
        <span>{label}</span>
        <b>
          {used}
          <span> / {unlimited ? "Unlimited" : limit}</span>
        </b>
      </div>
      {!unlimited && (
        <div className="ac-use-bar" aria-hidden="true">
          <span style={{ width: `${pct}%` }} />
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
      <div className="ac-plan">
        <div className="ac-uses">
          <UsageBar label={`Reports ${periodLabel}`} used={analysesUsed} limit={analysesLimit} />
          <UsageBar label={`Clips ${periodLabel}`} used={clipsUsed} limit={clipsLimit} />
          {/* Hours only apply on the paid plans. */}
          {typeof hoursLimit === "number" && hoursLimit > 0 && typeof hoursUsed === "number" && (
            <UsageBar label={`Hours analyzed ${periodLabel}`} used={hoursUsed} limit={hoursLimit} />
          )}
        </div>

        <div className="ac-plan-act">
          {plan === "free" ? (
            <>
              <p>
                {onTrial
                  ? `Free gives you ${analysesLimit} reports and ${clipsLimit} clips a week, reset every Monday. Pro is 15 reports and 20 clips a month.`
                  : "Pro is 15 reports and 20 clips a month, on streams up to 8 hours long."}
              </p>
              <button
                type="button"
                className="btn btn-blue"
                onClick={() => {
                  setUpgradeInitialTier("pro");
                  setUpgradeOpen(true);
                }}
              >
                Go Pro · $14.99/month
              </button>
            </>
          ) : isCancelled ? (
            <p>
              Your subscription is cancelled.
              {subscriptionExpiresAt && (
                <>
                  {" "}
                  Pro stays on until{" "}
                  <b>
                    {new Date(subscriptionExpiresAt).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </b>
                  .
                </>
              )}
            </p>
          ) : (
            <>
              <p>You&apos;re on {proPlus ? "Pro Plus" : "Pro"}. Thanks for backing LevlCast.</p>

              {/* Pro to Pro Plus. Only for Stripe subscribers: App Store and
                  PayPal plans change tier in their own billing. */}
              {!proPlus && hasStripeSubscription && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setUpgradeInitialTier("pro_plus");
                    setUpgradeOpen(true);
                  }}
                >
                  Go Pro Plus · $29.99/month
                </button>
              )}

              {hasStripeSubscription && (
                <>
                  {portalError && <p className="ac-err">{portalError}</p>}
                  <button type="button" className="ac-link" onClick={openPortal} disabled={portalLoading}>
                    {portalLoading && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
                    {portalLoading ? "Opening..." : "Manage subscription"}
                  </button>
                </>
              )}

              {hasPaypalSubscription && !hasStripeSubscription && (
                <p>
                  You subscribed with PayPal. To cancel, go to <b>paypal.com → Subscriptions → LevlCast</b>.
                </p>
              )}

              {!hasStripeSubscription && !hasPaypalSubscription && (
                <p>
                  You subscribed in the iPhone app. To cancel, go to{" "}
                  <b>Settings → your name → Subscriptions → LevlCast</b>.
                </p>
              )}
            </>
          )}
        </div>
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
