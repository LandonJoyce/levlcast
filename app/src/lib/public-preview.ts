/**
 * Public VOD previews — the no-account top of the funnel.
 *
 * A visitor pastes any public Twitch VOD URL at /analyze and gets a real
 * coach report on the opening stretch of that stream without signing in,
 * connecting anything, or paying. It is the same transcription, the same
 * peak detection and the same coach report the dashboard runs; the only
 * difference is how much of the VOD we look at.
 *
 * WHY 12 MINUTES
 * `analyzeVod` chunks transcription at CHUNK_SECONDS = 720 because that is
 * what reliably completes inside Vercel's 300s per-invocation cap. Matching
 * that number exactly means a preview is ONE chunk and ONE Deepgram call,
 * running a code path that is already proven in production. It also caps
 * the cost of a stranger's click at a few cents.
 *
 * WHY IT IS CACHED
 * Rows in `public_previews` are unique per Twitch VOD id, so the second
 * person to paste a link gets an instant page and costs nothing. That same
 * property is what makes the result URL stable enough to share.
 *
 * WHAT THIS FILE DOES NOT DO
 * No spend limiting and no rate limiting — those live in the API route,
 * where the request and the IP are. This module is the pure pipeline.
 */

import { getTwitchVodSegmentList, streamSegmentsToPassThrough, getAppAccessToken } from "@/lib/twitch";
import { mutedRanges, overlapSeconds, type TimeRange } from "@/lib/muted-audio";
import { transcribePassThrough, type TranscriptSegment } from "@/lib/deepgram";
import { detectPeaks, generateCoachReport } from "@/lib/analyze";
import { detectGame, keywordsForGame } from "@/lib/game-keywords";
import type { Peak } from "@/lib/analyze";
import type { CoachReport } from "@/lib/analyze";

/**
 * How much of the VOD a preview reads. Deliberately equal to the
 * transcription chunk size used by the full pipeline — see the header.
 */
export const PREVIEW_SECONDS = 720;

/**
 * How far a preview reads when the first PREVIEW_SECONDS are too quiet to
 * coach. Plenty of streams open on a starting-soon screen with music for
 * ten minutes or more, and those were turned away with "we couldn't hear
 * enough talking". Reading twice as far finds where they started, and the
 * coach drops the pre-stream part on its own (detectStreamStartOffset).
 */
export const LONG_PREVIEW_SECONDS = 24 * 60;

/** Under this many words in the window, the stream hadn't really started. */
const MIN_PREVIEW_WORDS = 200;

/** A window with too little talking to coach (no Claude spent finding that out). */
export function tooQuietToCoach(segments: TranscriptSegment[]): boolean {
  let words = 0;
  for (const s of segments) words += s.text.split(/\s+/).filter(Boolean).length;
  return words < MIN_PREVIEW_WORDS;
}

/** The window had no speech, or Twitch muted most of it: worth reading further in. */
export class QuietOpeningError extends Error {}

/**
 * Below this there isn't enough speech for the report to say anything
 * true, and Claude starts inventing. The full pipeline refuses under
 * 5 minutes for the same reason; previews hold the same line.
 */
export const MIN_PREVIEW_SECONDS = 5 * 60;

/**
 * Hard ceiling on previews started in a day, from everywhere at once: the
 * analyzer, outreach and new sign-ups all count toward it. At roughly a
 * nickel each this caps preview spend near $10/day. Raise it when the
 * funnel is proven, never remove it.
 */
export const PREVIEWS_PER_DAY = 200;

export interface PreviewVodMeta {
  twitchVodId: string;
  title: string;
  streamerLogin: string;
  streamerDisplayName: string;
  thumbnailUrl: string;
  durationSeconds: number;
}

export interface PreviewResult {
  coachReport: CoachReport | null;
  peaks: Peak[];
  gameCategory: string;
  analyzedSeconds: number;
}

// What people type into the box is read in lib/twitch-input.ts, so the
// homepage box can use the same rules without pulling in server code.
export { extractVodId, extractChannel, describeBadInput } from "@/lib/twitch-input";

/** What a Twitch name turned out to point at. */
export type ChannelLookup =
  | { kind: "vod"; vodId: string; login: string; displayName: string }
  | { kind: "no_channel" }
  | { kind: "no_vods"; displayName: string }
  | { kind: "too_short"; displayName: string };

/**
 * A channel's most recent past broadcast long enough to coach, for when
 * someone types their Twitch name instead of pasting a link. App token,
 * public data only, like fetchPreviewVodMeta.
 */
export async function latestVodForChannel(login: string): Promise<ChannelLookup> {
  const token = await getAppAccessToken();
  const headers = { "Client-Id": process.env.TWITCH_CLIENT_ID!, Authorization: `Bearer ${token}` };

  const userRes = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`, { headers });
  if (!userRes.ok) {
    if (userRes.status === 400) return { kind: "no_channel" };
    throw new Error(`Twitch returned ${userRes.status} looking up ${login}`);
  }
  const user = ((await userRes.json()) as { data?: Array<{ id: string; login: string; display_name: string }> }).data?.[0];
  if (!user) return { kind: "no_channel" };

  // Past broadcasts only: highlights and uploads aren't what they streamed.
  const vodRes = await fetch(`https://api.twitch.tv/helix/videos?user_id=${encodeURIComponent(user.id)}&type=archive&first=5`, {
    headers,
  });
  if (!vodRes.ok) throw new Error(`Twitch returned ${vodRes.status} listing past broadcasts for ${login}`);
  const vods = ((await vodRes.json()) as { data?: Array<{ id: string; duration: string }> }).data ?? [];
  const name = user.display_name || user.login;
  if (vods.length === 0) return { kind: "no_vods", displayName: name };
  const usable = vods.find((v) => parseHelixDuration(String(v.duration ?? "")) >= MIN_PREVIEW_SECONDS);
  if (!usable) return { kind: "too_short", displayName: name };
  return { kind: "vod", vodId: String(usable.id), login: user.login, displayName: name };
}

/**
 * Fetch a single VOD's public metadata from Helix using our app token.
 *
 * Deliberately app-token based: previews have no user and therefore no
 * user token, and public VOD metadata does not require one. Returns null
 * when the VOD is missing, deleted, or sub-only (Helix omits those), which
 * the caller turns into a friendly message.
 */
export async function fetchPreviewVodMeta(vodId: string): Promise<PreviewVodMeta | null> {
  const token = await getAppAccessToken();
  const res = await fetch(`https://api.twitch.tv/helix/videos?id=${encodeURIComponent(vodId)}`, {
    headers: {
      "Client-Id": process.env.TWITCH_CLIENT_ID!,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    // 404/400 here means "no such public VOD", which is a user-facing
    // condition rather than an outage. Anything else is worth surfacing.
    if (res.status === 404 || res.status === 400) return null;
    throw new Error(`Twitch returned ${res.status} fetching VOD ${vodId}`);
  }

  const json = (await res.json()) as { data?: Array<Record<string, unknown>> };
  const row = json.data?.[0];
  if (!row) return null;

  // Helix thumbnails come templated with %{width}x%{height}.
  const thumb = String(row.thumbnail_url ?? "")
    .replace("%{width}", "640")
    .replace("%{height}", "360");

  return {
    twitchVodId: String(row.id ?? vodId),
    title: String(row.title ?? "Untitled stream"),
    streamerLogin: String(row.user_login ?? ""),
    streamerDisplayName: String(row.user_name ?? ""),
    thumbnailUrl: thumb,
    durationSeconds: parseHelixDuration(String(row.duration ?? "")),
  };
}

/** Helix durations look like "3h22m14s". Missing units are simply absent. */
function parseHelixDuration(dur: string): number {
  const m = dur.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
  if (!m) return 0;
  const [, h, min, s] = m;
  return Number(h ?? 0) * 3600 + Number(min ?? 0) * 60 + Number(s ?? 0);
}

/**
 * Transcribe the opening window of a VOD.
 *
 * Splitting this out from the report generation lets the Inngest function
 * put each half in its own step, so a Deepgram hiccup retries the
 * transcription without re-running Claude (and re-billing it).
 */
export async function transcribePreviewWindow(
  twitchVodId: string,
  title: string,
  windowSeconds: number = PREVIEW_SECONDS
): Promise<{ segments: TranscriptSegment[]; gameCategory: string; analyzedSeconds: number; muted: TimeRange[] }> {
  const detection = detectGame(title);
  const keywords = keywordsForGame(detection);

  const list = await getTwitchVodSegmentList(twitchVodId);
  if (list.urls.length === 0) {
    throw new Error("Twitch returned no playable segments for this VOD.");
  }

  // Take every segment that STARTS inside the preview window. Using the
  // start time (rather than counting segments) keeps the window honest
  // across VODs with different segment lengths.
  const urls: string[] = [];
  for (let i = 0; i < list.urls.length; i++) {
    const startsAt = list.startTimes[i] ?? 0;
    if (startsAt >= windowSeconds) break;
    urls.push(list.urls[i]);
  }

  if (urls.length === 0) {
    throw new Error("Couldn't read the opening of this VOD.");
  }

  // The last included segment runs past the window boundary; report the
  // window rather than the segment end so the number shown to the user
  // matches what we promised.
  const analyzedSeconds = Math.min(
    windowSeconds,
    Math.round(list.startTimes[urls.length - 1] ?? windowSeconds)
  );

  const initSegment = list.initSegmentBase64
    ? Buffer.from(list.initSegmentBase64, "base64")
    : null;

  // Muted segments stay in (dropping them would shift every timestamp in
  // this single request); the coach is told where they are instead.
  const muted = mutedRanges(list.startTimes.slice(0, urls.length), (list.muted ?? []).slice(0, urls.length));
  const window = analyzedSeconds || windowSeconds;

  const stream = streamSegmentsToPassThrough(urls, initSegment);
  const { segments } = await transcribePassThrough(stream, keywords);

  if (segments.length === 0) {
    if (overlapSeconds(0, window, muted) > window * 0.5) {
      throw new QuietOpeningError(
        "Twitch muted the start of this stream for copyrighted music, so the part the free preview reads is silent. Try a different stream."
      );
    }
    throw new QuietOpeningError("No speech detected in the opening of this stream. It may be muted, music-only, or starting-soon screen.");
  }

  return {
    segments,
    gameCategory: detection.category,
    analyzedSeconds: window,
    muted,
  };
}

/**
 * The opening of a stream for the preview: the first PREVIEW_SECONDS, or
 * the first LONG_PREVIEW_SECONDS when that much is a quiet starting-soon
 * screen and the stream runs longer.
 */
export async function transcribeOpening(twitchVodId: string, title: string, streamSeconds: number) {
  const canReadFurther = streamSeconds > PREVIEW_SECONDS + 60;
  try {
    const first = await transcribePreviewWindow(twitchVodId, title);
    if (!canReadFurther || !tooQuietToCoach(first.segments)) return first;
    console.log(`[preview] ${twitchVodId}: opening too quiet to coach, reading ${LONG_PREVIEW_SECONDS / 60} minutes`);
  } catch (err) {
    if (!(err instanceof QuietOpeningError) || !canReadFurther) throw err;
    console.log(`[preview] ${twitchVodId}: ${err.message} Reading ${LONG_PREVIEW_SECONDS / 60} minutes instead.`);
  }
  return transcribePreviewWindow(twitchVodId, title, LONG_PREVIEW_SECONDS);
}

/**
 * Run peaks + coach report over an already-transcribed preview window.
 *
 * No prior reports and no chat pulse are passed: a preview has no history
 * to compare against, which is exactly the gap the paid product fills.
 */
export async function buildPreviewReport(
  segments: TranscriptSegment[],
  title: string,
  excerpt?: { analyzedSeconds: number; totalSeconds: number },
  muted: TimeRange[] = []
): Promise<{ coachReport: CoachReport | null; peaks: Peak[] }> {
  const peaks = await detectPeaks(segments, title);
  // `excerpt` is what stops the model from judging a five-hour stream by
  // its first twelve minutes and calling the result a stream score.
  // Medium effort: this runs in the same Inngest step as detectPeaks, so it
  // has less of Vercel's 300 seconds to spare than a full report does.
  const coachReport = await generateCoachReport(segments, title, peaks, undefined, undefined, undefined, excerpt, muted, "medium");
  return { coachReport, peaks };
}
