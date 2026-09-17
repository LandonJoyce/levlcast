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
 * Below this there isn't enough speech for the report to say anything
 * true, and Claude starts inventing. The full pipeline refuses under
 * 5 minutes for the same reason; previews hold the same line.
 */
export const MIN_PREVIEW_SECONDS = 5 * 60;

/** Longest URL we'll even look at. Guards against absurd POST bodies. */
const MAX_URL_LENGTH = 500;

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

/**
 * Pull the numeric VOD id out of anything a human might paste.
 *
 * Accepts the forms people actually use: a full twitch.tv/videos/<id> URL
 * with or without scheme, with or without www, with tracking query params
 * or a ?t= timestamp, and a bare id typed on its own. Returns null for
 * clip URLs and channel URLs, which are the two most common wrong pastes
 * and need a specific error message rather than a generic one.
 */
export function extractVodId(input: string): string | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw || raw.length > MAX_URL_LENGTH) return null;

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

/**
 * Tell the visitor precisely what they pasted wrong. A generic "invalid
 * link" on the very first interaction is how you lose a first-time user,
 * so each wrong shape gets its own sentence.
 */
export function describeBadUrl(input: string): string {
  const raw = (input || "").trim();
  if (!raw) return "Paste a Twitch VOD link to get started.";
  if (/\/clip\//i.test(raw) || /clips\.twitch\.tv/i.test(raw)) {
    return "That's a clip link. Open the full stream on Twitch and copy that URL instead — it looks like twitch.tv/videos/1234567890.";
  }
  if (/youtube\.com|youtu\.be/i.test(raw)) {
    return "That's a YouTube link. LevlCast reads Twitch VODs right now — paste a link like twitch.tv/videos/1234567890.";
  }
  if (/twitch\.tv/i.test(raw)) {
    return "That looks like a Twitch channel rather than a specific stream. Open the VOD you want and copy the URL — it looks like twitch.tv/videos/1234567890.";
  }
  return "That doesn't look like a Twitch VOD link. Paste one that looks like twitch.tv/videos/1234567890.";
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
  title: string
): Promise<{ segments: TranscriptSegment[]; gameCategory: string; analyzedSeconds: number }> {
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
    if (startsAt >= PREVIEW_SECONDS) break;
    urls.push(list.urls[i]);
  }

  if (urls.length === 0) {
    throw new Error("Couldn't read the opening of this VOD.");
  }

  // The last included segment runs past the window boundary; report the
  // window rather than the segment end so the number shown to the user
  // matches what we promised.
  const analyzedSeconds = Math.min(
    PREVIEW_SECONDS,
    Math.round(list.startTimes[urls.length - 1] ?? PREVIEW_SECONDS)
  );

  const initSegment = list.initSegmentBase64
    ? Buffer.from(list.initSegmentBase64, "base64")
    : null;

  const stream = streamSegmentsToPassThrough(urls, initSegment);
  const { segments } = await transcribePassThrough(stream, keywords);

  if (segments.length === 0) {
    throw new Error("No speech detected in the opening of this stream. It may be muted, music-only, or starting-soon screen.");
  }

  return {
    segments,
    gameCategory: detection.category,
    analyzedSeconds: analyzedSeconds || PREVIEW_SECONDS,
  };
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
  excerpt?: { analyzedSeconds: number; totalSeconds: number }
): Promise<{ coachReport: CoachReport | null; peaks: Peak[] }> {
  const peaks = await detectPeaks(segments, title);
  // `excerpt` is what stops the model from judging a five-hour stream by
  // its first twelve minutes and calling the result a stream score.
  const coachReport = await generateCoachReport(segments, title, peaks, undefined, undefined, undefined, excerpt);
  return { coachReport, peaks };
}
