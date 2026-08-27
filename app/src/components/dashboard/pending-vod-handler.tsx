"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const PENDING_KEY = "levlcast_pending_vod_url";

type Phase = "idle" | "submitting" | "error";

/**
 * After OAuth returns the user to /dashboard, this component checks
 * localStorage for a URL they pasted on the landing page. If one exists,
 * it posts to /api/twitch/vods/analyze-by-url which queues that specific
 * VOD for analysis, then redirects to the VOD's live-progress page.
 *
 * Renders nothing unless there's a pending URL or an error to display.
 */
export default function PendingVodHandler() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const firedRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (firedRef.current) return;

    let pendingUrl: string | null = null;
    try {
      pendingUrl = localStorage.getItem(PENDING_KEY);
    } catch {
      return;
    }
    if (!pendingUrl) return;

    firedRef.current = true;
    setPhase("submitting");

    (async () => {
      // Clear immediately so a page refresh doesn't re-fire the request
      try { localStorage.removeItem(PENDING_KEY); } catch {}

      try {
        const res = await fetch("/api/twitch/vods/analyze-by-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: pendingUrl }),
        });
        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          setErrorMsg(json?.error || "Couldn't queue that VOD. Try syncing your streams instead.");
          setPhase("error");
          return;
        }
        if (json?.vodId) {
          router.replace(`/dashboard/vods/${json.vodId}`);
          return;
        }
        setPhase("idle");
      } catch {
        setErrorMsg("Network error. Try syncing your streams from the VODs page.");
        setPhase("error");
      }
    })();
  }, [router]);

  if (phase === "submitting") {
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
          Queueing the VOD you pasted on the landing page…
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
            Couldn't queue that VOD
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
