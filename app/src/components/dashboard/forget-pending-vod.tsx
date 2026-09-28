"use client";

import { useEffect } from "react";

/**
 * A new streamer lands on their first stream straight from sign-in, with
 * their first report already running (auth/callback). A VOD link they
 * pasted on the homepage before signing up has nothing left to do, and
 * would otherwise fire on their first visit to the dashboard
 * (pending-vod-handler.tsx) and bounce them back to this page, or queue a
 * second report they never asked for.
 */
export function ForgetPendingVod() {
  useEffect(() => {
    try {
      localStorage.removeItem("levlcast_pending_vod_url");
    } catch {
      // No storage, nothing to forget.
    }
  }, []);
  return null;
}
