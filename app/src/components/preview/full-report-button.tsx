"use client";

/**
 * "Get my full report" on a free preview.
 *
 * Remembers which stream was previewed (a short-lived cookie, since the
 * Twitch sign-in round trip drops everything else) so a new streamer's
 * first full report is the stream they were just looking at, if it's
 * theirs. The auth callback reads it; see app/auth/callback/route.ts.
 */

import { track } from "@/components/funnel/track";

export const PENDING_VOD_COOKIE = "levlcast_pending_vod";

export function FullReportButton({ vodId, label = "Get my full report" }: { vodId: string; label?: string }) {
  return (
    <a
      href="/auth/login"
      className="v3-btn"
      onClick={() => {
        track("cta", vodId);
        if (/^\d{6,}$/.test(vodId)) {
          document.cookie = `${PENDING_VOD_COOKIE}=${vodId}; Max-Age=3600; Path=/; SameSite=Lax`;
        }
      }}
    >
      {label}
    </a>
  );
}
