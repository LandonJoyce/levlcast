"use client";

/**
 * "Get my full report" on a free preview.
 *
 * Remembers which stream was previewed (a short-lived cookie, since the
 * Twitch sign-in round trip drops everything else) so a new streamer's
 * first full report is the stream they were just looking at, if it's
 * theirs. The auth callback reads it; see app/auth/callback/route.ts.
 */

import { useEffect, useState } from "react";
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

/**
 * Phones only (see .pr-stick in analyze.css): the button pinned to the
 * bottom once the reader has scrolled past the one under the score and
 * until the closing pitch comes into view. On a phone the report runs
 * about two screens between them, and that's where people read the fix
 * and then had no button in reach (2026-10-07: 3 of 11 pressed it).
 */
export function StickyFullReport({ vodId }: { vodId: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const top = document.querySelector(".pr-cta");
    const end = document.querySelector(".pr-more");
    if (!top || !end || !("IntersectionObserver" in window)) return;
    let pastTop = false;
    let endInView = false;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === top) pastTop = !e.isIntersecting && e.boundingClientRect.top < 0;
        if (e.target === end) endInView = e.isIntersecting;
      }
      setShow(pastTop && !endInView);
    });
    io.observe(top);
    io.observe(end);
    return () => io.disconnect();
  }, []);
  if (!show) return null;
  return (
    <div className="pr-stick">
      <p>Free with Twitch. No card.</p>
      <FullReportButton vodId={vodId} />
    </div>
  );
}
