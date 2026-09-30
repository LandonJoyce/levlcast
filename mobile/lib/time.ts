import { Linking } from 'react-native';

/**
 * Times, one way everywhere (mirrors the site's lib/moment-time.ts).
 * Reports write "M:SS" with minutes running past 60 ("102:10") and
 * sometimes "H:MM:SS"; clips and moments carry plain seconds.
 */

/** "4:05", "102:10" or "1:42:10" to seconds. */
export function secondsFromStamp(t: string | null | undefined): number {
  if (!t) return 0;
  return t
    .trim()
    .split(':')
    .reduce((acc, part) => acc * 60 + (Number(part) || 0), 0);
}

/** Seconds as "1:42:10", or "4:05" under an hour. */
export function clock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

function twitchTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return h > 0 ? `${h}h${m}m${s}s` : m > 0 ? `${m}m${s}s` : `${s}s`;
}

/** The past broadcast on Twitch at `seconds`. Opens the Twitch app when it's installed. */
export function twitchVodAt(vodId: string, seconds: number): string {
  return `https://www.twitch.tv/videos/${vodId}?t=${twitchTime(seconds)}`;
}

/** Plays a moment: the Twitch past broadcast, a few seconds before it. */
export function watchAt(vodId: string | null | undefined, seconds: number) {
  if (!vodId) return;
  Linking.openURL(twitchVodAt(vodId, Math.max(0, seconds - 3))).catch(() => {});
}

/**
 * A time written in prose. The coach sometimes writes "at 1:42" meaning
 * 1:42:10, so when one of the exact times it gave elsewhere falls in that
 * hour and minute, that's the one.
 */
export function resolveStamp(time: string, known: number[]): number {
  const plain = secondsFromStamp(time);
  const parts = time.split(':');
  if (parts.length !== 2) return plain;
  const hourMinute = Number(parts[0]) * 3600 + Number(parts[1]) * 60;
  return known.find((k) => k >= hourMinute && k < hourMinute + 60) ?? plain;
}

/** Times inside text: "4:05", "102:10", "1:42:10". */
export const TIME_IN_TEXT = /\b\d{1,3}:\d{2}(?::\d{2})?\b/g;

/** "Sep 12", with the year when it isn't this year. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** "3h 12m" or "48m". */
export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** "1h 36m", "3h" or "36m". */
export function streamLength(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** "2d 4h", "3h 10m" or "12m" until an ISO time. */
export function untilText(iso: string): string {
  const ms = Math.max(0, Date.parse(iso) - Date.now());
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${Math.max(1, m)}m`;
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** "+34" or "−12" (a real minus, like the site). */
export function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0';
}

/** Coach text with its long dashes turned into plain punctuation. */
export function clean(s: string): string {
  return s.replace(/ — /g, '. ').replace(/—/g, ' ').trim();
}
