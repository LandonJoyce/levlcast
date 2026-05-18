"use client";

import { useEffect, useRef, useState } from "react";

const PENDING_KEY = "levlcast_pending_checkout";

/**
 * After OAuth returns to /dashboard, this component checks localStorage for
 * a plan slug the visitor selected on the landing page (Get Pro / Get Pro
 * Plus). If one exists, it posts to /api/stripe/checkout and redirects to
 * Stripe so the user doesn't have to find the upgrade button manually.
 *
 * Mirrors the PendingVodHandler pattern used for URL-paste analyze flow.
 *
 * Renders a small "Redirecting to checkout..." overlay while in flight so
 * the user doesn't accidentally interact with the dashboard during the
 * Stripe redirect.
 */
export default function PendingCheckoutHandler() {
  const [phase, setPhase] = useState<"idle" | "redirecting" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;

    let pendingPlan: string | null = null;
    try {
      pendingPlan = localStorage.getItem(PENDING_KEY);
    } catch {
      return;
    }
    if (!pendingPlan) return;

    firedRef.current = true;
    setPhase("redirecting");

    (async () => {
      // Clear immediately so a page refresh doesn't re-fire the request
      try { localStorage.removeItem(PENDING_KEY); } catch {}

      try {
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: pendingPlan }),
        });
        const json = await res.json().catch(() => ({}));

        if (!res.ok || !json?.url) {
          setErrorMsg(json?.error || "Couldn't open Stripe checkout. Try the Upgrade button on this page.");
          setPhase("error");
          return;
        }
        window.location.href = json.url;
      } catch {
        setErrorMsg("Network error during checkout. Try the Upgrade button on this page.");
        setPhase("error");
      }
    })();
  }, []);

  if (phase === "redirecting") {
    return (
      <div
        className="rounded-xl px-4 py-3 mb-5 flex items-center gap-3"
        style={{
          background: "rgba(255,88,0,0.06)",
          border: "1px solid rgba(255,88,0,0.22)",
        }}
      >
        <div
          style={{
            width: 14, height: 14, borderRadius: "50%",
            border: "2px solid rgba(255,176,140,0.3)",
            borderTopColor: "#FFB08C",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <p className="text-[13px] text-white/85 m-0">
          Redirecting you to Stripe checkout…
        </p>
        <style jsx>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  if (phase === "error" && errorMsg) {
    return (
      <div
        className="rounded-xl px-4 py-3 mb-5 flex items-start gap-3"
        style={{
          background: "rgba(248,113,113,0.06)",
          border: "1px solid rgba(248,113,113,0.22)",
        }}
      >
        <div className="flex-1">
          <p className="text-[12px] font-extrabold uppercase tracking-widest mb-1" style={{ color: "#F87171" }}>
            Checkout didn't open
          </p>
          <p className="text-[13px] text-white/80 m-0">{errorMsg}</p>
        </div>
        <button
          onClick={() => { setPhase("idle"); setErrorMsg(null); }}
          className="text-white/40 hover:text-white/70 text-[11px] font-semibold"
        >
          Dismiss
        </button>
      </div>
    );
  }

  return null;
}
