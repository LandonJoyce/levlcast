"use client";

import type { ReactNode } from "react";

/**
 * "Add it to OBS" from the public site. Goes to the dashboard, where the
 * Add to OBS window opens (AppBar reads ?obs=1). Someone signed out goes
 * through Twitch sign-in first, which drops the query on the way back, so
 * the ask also waits in localStorage, like a Go Pro button's plan does.
 */
export default function AddToObsLink({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <a
      href="/dashboard?obs=1"
      className={className}
      onClick={() => {
        try {
          localStorage.setItem("levlcast_pending_obs", "1");
        } catch {}
      }}
    >
      {children}
    </a>
  );
}
