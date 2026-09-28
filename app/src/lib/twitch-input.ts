/**
 * Reading what someone types into the free analyzer's box: a link to one
 * stream, or their Twitch name. Pure functions with no server imports, so
 * the homepage box and the preview API read input exactly the same way.
 *
 * Why names: most people who try LevlCast arrive from a DM on their phone,
 * and finding one stream's link means leaving for the Twitch app, going to
 * Videos, a stream, Share, Copy link and back. Everyone knows their own
 * Twitch name. The API turns a name into their latest past broadcast.
 */

/** Longest input we'll even look at. Guards against absurd POST bodies. */
export const MAX_INPUT_LENGTH = 500;

/**
 * Pull the numeric VOD id out of anything a human might paste.
 *
 * Accepts the forms people actually use: a full twitch.tv/videos/<id> URL
 * with or without scheme, with or without www, with tracking query params
 * or a ?t= timestamp, and a bare id typed on its own. Returns null for
 * clip URLs and channel URLs; a channel is read by extractChannel instead.
 */
export function extractVodId(input: string): string | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw || raw.length > MAX_INPUT_LENGTH) return null;

  // Bare id, e.g. someone copies just the number out of the URL bar.
  if (/^\d{6,}$/.test(raw)) return raw;

  // Normalise to something URL can parse so we handle scheme-less pastes
  // ("twitch.tv/videos/123") the same as full links.
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (host !== "twitch.tv" && host !== "m.twitch.tv") return null;

  // /videos/<id> is the only shape that is a VOD. Clips live at
  // /<channel>/clip/<slug> and are not analyzable here.
  const match = parsed.pathname.match(/^\/videos\/(\d{6,})\/?$/);
  return match ? match[1] : null;
}

/** Twitch pages at twitch.tv/<word> that aren't anybody's channel. */
const NOT_CHANNELS = new Set([
  "videos", "directory", "settings", "downloads", "p", "jobs", "turbo", "subscriptions", "inventory",
  "wallet", "drops", "search", "friends", "messages", "following", "payments", "login", "signup", "store",
  "bits", "prime", "broadcast", "creatorcamp", "u", "moderator", "popout", "embed", "team", "collections",
  "clip", "clips", "dashboard", "privacy", "legal", "security", "subs", "products", "user", "event",
]);

/** A channel page's own tabs, all of which mean "this channel". */
const CHANNEL_TABS = new Set(["videos", "about", "schedule", "home", "clips"]);

/** Twitch logins are letters, digits and underscores. */
const LOGIN = /^[a-z0-9_]{3,25}$/i;

/**
 * A Twitch channel name, from a channel link (twitch.tv/name, with or
 * without a tab like /videos), an @name, or the name typed on its own.
 * Null for anything else, including clip links and one-stream links.
 */
export function extractChannel(input: string): string | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw || raw.length > MAX_INPUT_LENGTH) return null;

  // The name on its own. All digits is a VOD id, not a name.
  const bare = raw.replace(/^@/, "");
  if (LOGIN.test(bare) && !/^\d+$/.test(bare)) return bare.toLowerCase();

  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (host !== "twitch.tv" && host !== "m.twitch.tv") return null;

  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts.length === 0 || parts.length > 2) return null;
  const [name, tab] = parts;
  if (tab && !CHANNEL_TABS.has(tab.toLowerCase())) return null;
  if (!LOGIN.test(name) || NOT_CHANNELS.has(name.toLowerCase())) return null;
  return name.toLowerCase();
}

/**
 * Tell the visitor precisely what went wrong with what they typed. A
 * generic "invalid link" on the very first interaction is how you lose a
 * first-time user, so each wrong shape gets its own sentence.
 */
export function describeBadInput(input: string): string {
  const raw = (input || "").trim();
  if (!raw) return "Type your Twitch name to get started.";
  if (/\/clip\//i.test(raw) || /clips\.twitch\.tv/i.test(raw)) {
    return "That's a clip link. Type your Twitch name instead and we'll read your latest stream.";
  }
  if (/youtube\.com|youtu\.be/i.test(raw)) {
    return "That's a YouTube link. LevlCast only reads Twitch streams for now, so type your Twitch name instead.";
  }
  if (/twitch\.tv/i.test(raw)) {
    return "That Twitch link isn't a channel or a stream. Type your Twitch name instead.";
  }
  if (/\s/.test(raw)) {
    return "Twitch names don't have spaces. Type yours the way it's written in your channel link, or paste a link to one of your streams.";
  }
  return "That doesn't look like a Twitch name. Type yours the way it's written in your channel link, or paste a link to one of your streams.";
}
