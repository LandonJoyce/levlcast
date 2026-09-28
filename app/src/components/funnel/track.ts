"use client";

/**
 * Report one step of the signup funnel from the browser. See lib/funnel.ts.
 * Fire and forget: it uses a keepalive request so a step recorded as the
 * page navigates away (pressing "Continue with Twitch") still arrives, and
 * it never throws.
 */

import { REF_COOKIE, REF_PATTERN, VISITOR_COOKIE, type ClientEvent } from "@/lib/funnel";

function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function visitorId(): string {
  let id = readCookie(VISITOR_COOKIE);
  if (!id) {
    id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    document.cookie = `${VISITOR_COOKIE}=${id}; Max-Age=31536000; Path=/; SameSite=Lax`;
  }
  return id;
}

/**
 * Remember where this visitor came from. The first ref wins: someone who
 * clicks a DM, leaves, and comes back through the homepage a day later
 * still counts as having come from the DM.
 */
export function rememberRef(ref: string | null | undefined): string | null {
  try {
    const existing = readCookie(REF_COOKIE);
    if (existing) return existing;
    const clean = (ref ?? "").toLowerCase();
    if (!REF_PATTERN.test(clean)) return null;
    document.cookie = `${REF_COOKIE}=${clean}; Max-Age=2592000; Path=/; SameSite=Lax`;
    return clean;
  } catch {
    return null;
  }
}

export function track(event: ClientEvent, detail?: string, ref?: string | null): void {
  try {
    visitorId();
    void fetch("/api/funnel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, detail, ref: ref ?? undefined }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Never let tracking break the page.
  }
}
