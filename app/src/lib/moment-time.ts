/**
 * Moment times, one way everywhere.
 *
 * Reports write times as "M:SS" with minutes running past 60 ("102:10"),
 * and sometimes as "H:MM:SS"; clips and peaks carry plain seconds. The
 * old readers disagreed: the full breakdown read "1:42:10" as 1:42 and
 * opened Twitch an hour and a half early.
 */

/** "4:05", "102:10" or "1:42:10" to seconds. NaN parts count as 0. */
export function secondsFromStamp(t: string | null | undefined): number {
  if (!t) return 0;
  return t
    .trim()
    .split(":")
    .reduce((acc, part) => acc * 60 + (Number(part) || 0), 0);
}

/** Seconds as "1:42:10", or "4:05" under an hour. */
export function clock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

/** Twitch's own time format, "1h42m10s". */
function twitchTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return h > 0 ? `${h}h${m}m${s}s` : m > 0 ? `${m}m${s}s` : `${s}s`;
}

/** The past broadcast on twitch.tv, starting at `seconds`. */
export function twitchVodAt(vodId: string, seconds: number): string {
  return `https://www.twitch.tv/videos/${vodId}?t=${twitchTime(seconds)}`;
}

/**
 * Twitch's embeddable player for a past broadcast. Twitch only plays it
 * on the domains named in `parent`, which has to be the page's own host.
 */
export function twitchEmbedAt(vodId: string, seconds: number, parent: string): string {
  const q = new URLSearchParams({ video: `v${vodId}`, parent, time: twitchTime(seconds), autoplay: "true" });
  return `https://player.twitch.tv/?${q}`;
}

/** Twitch keeps most past broadcasts 7 days (14 for Affiliates, 60 for Partners). */
export const TWITCH_SHORTEST_KEEP_DAYS = 7;
