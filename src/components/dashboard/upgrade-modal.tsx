"use client";

import { useEffect, useRef } from "react";
import { X, Check } from "lucide-react";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason: string;
}

const FEATURES = [
  "Unlimited VOD analyses",
  "Unlimited clip generation",
  "Priority processing",
];

export function UpgradeModal({ isOpen, onClose, reason }: UpgradeModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Remove any previously injected PayPal script
    if (scriptRef.current) {
      scriptRef.current.remove();
      scriptRef.current = null;
    }

    // Clear previous button render
    if (containerRef.current) {
      containerRef.current.innerHTML = "";
    }

    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID}&vault=true&intent=subscription`;
    script.setAttribute("data-sdk-integration-source", "button-factory");
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
            return actions.subscription.create({
              plan_id: process.env.NEXT_PUBLIC_PAYPAL_PLAN_ID,
            });
          },
          onApprove: async (data: any) => {
            await fetch("/api/subscription/paypal", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "activate",
                subscriptionId: data.subscriptionID,
              }),
            });
            window.location.reload();
          },
          onError: (err: any) => {
            console.error("[PayPal] Button error:", err);
          },
        })
        .render("#paypal-button-container");
    };

    document.body.appendChild(script);

    return () => {
      if (scriptRef.current) {
        scriptRef.current.remove();
        scriptRef.current = null;
      }
    };
  }, [isOpen]);

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
          <div id="paypal-button-container" ref={containerRef} />
        </div>
      </div>
    </div>
  );
}
