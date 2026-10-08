/**
 * The signup funnel: the steps between a link and an account, recorded in
 * funnel_events (migration 033) so it's possible to see where people drop.
 *
 * Shared by the browser beacon, the /api/funnel route, the auth callback
 * and the outreach page, so the names and codes can't drift apart.
 */

/** Steps a visitor's browser may report. "signup" is only ever written by the server. */
export const CLIENT_EVENTS = [
  "land",
  "preview_start",
  "preview_ready",
  "preview_refused",
  "preview_failed",
  "cta",
  "signin_start",
  // A signed-in person opened the app, once a day per browser. Not a funnel
  // step: it's how the outreach page tells a user who came back from one
  // whose reports were made by the background jobs. The server records it
  // against the session's account, never an id the page sends.
  "app_open",
] as const;
export type ClientEvent = (typeof CLIENT_EVENTS)[number];
export type FunnelEvent = ClientEvent | "signup";

/** Random id for one browser, first-party, a year. */
export const VISITOR_COOKIE = "lc_vid";
/** Where the visitor first came from (first touch wins), 30 days. */
export const REF_COOKIE = "lc_ref";

export const REF_PATTERN = /^[a-z0-9-]{1,40}$/;

/**
 * The code an outreach DM's link carries for the Reddit account it was sent
 * to: "dm-" and a short hash of the lowercased username. Deterministic, so
 * the browser and the server get the same code without storing one, and
 * opaque, so the link doesn't spell out who it was sent to.
 */
export function dmRef(username: string): string {
  let h = 0x811c9dc5;
  for (const ch of username.trim().replace(/^\/?u\//i, "").toLowerCase()) {
    h ^= ch.codePointAt(0) ?? 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `dm-${h.toString(36).padStart(7, "0").slice(-7)}`;
}

/**
 * When DM links started carrying a code (the deploy of 4eff648). DMs sent
 * before this had the bare link, so a click from one can't be told apart
 * from any other visitor, and counting them in the DM row would make it
 * look like nobody clicks.
 */
export const DM_CODES_SINCE = "2026-09-28T15:15:00Z";

/** The analyzer link every DM uses, before the per-person code. */
export const OUTREACH_BASE_LINK = "https://www.levlcast.com/analyze";

/**
 * Put the recipient's code on the analyzer link in a DM body. Drafts are
 * written with the bare link; the code goes on at send time, so queued
 * drafts written before this existed get it too.
 */
export function withDmRef(body: string, username: string): string {
  const code = dmRef(username);
  // The analyzer, or someone's own report at /analyze/<vodId>.
  return body.replace(
    /https:\/\/www\.levlcast\.com\/analyze(\/\d{6,})?(?:\?ref=[a-z0-9-]*)?(?![\w/?])/g,
    (_m, report: string | undefined) => `${OUTREACH_BASE_LINK}${report ?? ""}?ref=${code}`
  );
}
