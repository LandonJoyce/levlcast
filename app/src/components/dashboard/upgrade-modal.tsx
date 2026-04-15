"use client";

import { useEffect, useRef, useState } from "react";
import { X, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const [paypalError, setPaypalError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Fetch the current user ID when the modal opens — needed so PayPal can
  // attach it as custom_id on the subscription. If the browser disconnects
  // mid-flow, the webhook uses custom_id to recover the orphaned payment.
  useEffect(() => {
    if (!isOpen) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    // Wait until we have the user ID before mounting the PayPal button
    if (!userId) return;
    setPaypalError(null);

    // Remove any previously injected PayPal script
    if (scriptRef.current) {
      scriptRef.current.remove();
      scriptRef.current = null;
    }

    // Clear previous button render
    if (containerRef.current) {
      containerRef.current.innerHTML = "";
    }

    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    const planId = process.env.NEXT_PUBLIC_PAYPAL_PLAN_ID;

    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&components=buttons&intent=subscription&vault=true&currency=USD`;
    script.setAttribute("data-sdk-integration-source", "developer-studio");
    scriptRef.current = script;

    script.onload = () => {
      if (!containerRef.current) return;

      (window as any).paypal
        .Buttons({
          style: {
            shape: "rect",
            color: "gold",
            layout: "vertical",
            label: "subscribe",
          },
          createSubscription: (_data: any, actions: any) => {
            // Pass LevlCast user ID as custom_id so the webhook can recover
            // orphaned payments if the browser disconnects before onApprove fires.
            return actions.subscription.create({
              plan_id: planId,
              custom_id: userId,
            });
          },
          onApprove: async (data: any) => {
            setActivating(true);
            setPaypalError(null);
            try {
              const res = await fetch("/api/subscription/paypal", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "activate",
                  subscriptionId: data.subscriptionID,
                }),
              });
              if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                setPaypalError(json.error || "Activation failed. Please contact support with your PayPal transaction ID.");
                return;
              }
              window.location.reload();
            } catch {
              setPaypalError("Network error activating subscription. Please contact support.");
            } finally {
              setActivating(false);
            }
          },
          onError: (err: any) => {
            console.error("[PayPal] Button error:", err);
            setPaypalError("PayPal encountered an error. Please try again or use a different payment method.");
          },
        })
        .render(containerRef.current);
    };

    script.onerror = () => {
      setPaypalError("Failed to load PayPal. Check your connection or disable ad blockers and try again.");
    };

    document.body.appendChild(script);

    return () => {
      if (scriptRef.current) {
        scriptRef.current.remove();
        scriptRef.current = null;
      }
    };
  }, [isOpen, userId]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
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
          {/* Reason */}
          <p className="text-sm text-muted">{reason}</p>

          {/* Price */}
          <div className="bg-accent/10 border border-accent/20 rounded-xl p-4">
            <p className="text-2xl font-extrabold text-accent-light">
              $9.99
              <span className="text-sm font-normal text-muted ml-1">/month</span>
            </p>
            <p className="text-xs text-muted mt-1">Cancel anytime</p>
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

          {/* PayPal button */}
          {activating ? (
            <div className="text-center py-4 text-sm text-muted">Activating your subscription...</div>
          ) : (
            <div ref={containerRef} />
          )}

          {paypalError && (
            <p className="text-xs text-red-400 text-center">{paypalError}</p>
          )}
        </div>
      </div>
    </div>
  );
}
