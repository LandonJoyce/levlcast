/**
 * lib/twitch.ts — Twitch API integration and VOD audio handling.
 *
 * WHAT THIS FILE DOES:
 *   - Authenticates with Twitch using client credentials (App Access Token)
 *   - Fetches a user's VOD list from the Twitch Helix API
 *   - Gets the M3U8 audio stream URL for a VOD (via Twitch's internal GraphQL API)
 *   - Provides two ways to get VOD audio:
 *       downloadTwitchVodAudio() — downloads segments to a temp file on disk
 *       streamTwitchVodAudio()   — streams segments directly as a PassThrough (no disk)
 *
 * WHICH AUDIO METHOD TO USE:
 *   - Use streamTwitchVodAudio() in the analysis pipeline (Inngest job).
 *     It pipes audio directly to Deepgram with no disk writes — faster and safer on Vercel.
 *   - Use downloadTwitchVodAudio() for clip generation, which needs a local file for FFmpeg.
 *
 * TOKEN CACHING:
 *   The App Access Token is cached in memory until expiry. On Vercel (serverless),
 *   this cache only lives for the duration of the function invocation.
 */

import { createWriteStream } from "fs";
import { mkdtemp, unlink, rmdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { PassThrough } from "stream";

const HELIX_BASE = "https://api.twitch.tv/helix";

let cachedAppToken: { token: string; expiresAt: number } | null = null;

/** Thrown when Twitch returns 401 — signals that the stored token is expired and needs refreshing. */
export class TwitchAuthError extends Error {
  constructor() {
    super("Twitch auth token expired");
    this.name = "TwitchAuthError";
  }
}

/**
 * Exchange a Twitch refresh token for a new access + refresh token pair.
 * Call this when a GQL or API request returns 401, then retry with the new token.
 */
export async function refreshTwitchToken(
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.TWITCH_CLIENT_ID!,
      client_secret: process.env.TWITCH_CLIENT_SECRET!,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Twitch token refresh failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  return { accessToken: json.access_token, refreshToken: json.refresh_token };
}

/**
 * Get a Twitch App Access Token using client credentials.
 * Cached in memory until expiry.
 */
export async function getAppAccessToken(): Promise<string> {
  if (cachedAppToken && Date.now() < cachedAppToken.expiresAt) {
    return cachedAppToken.token;
  }

  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID!,
      client_secret: process.env.TWITCH_CLIENT_SECRET!,
      grant_type: "client_credentials",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to get Twitch app token: ${res.status} - ${body}`);
  }

  const json = await res.json();
  cachedAppToken = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in - 60) * 1000,
  };
  return cachedAppToken.token;
}

interface TwitchVod {
  id: string;
  title: string;
  duration: string;
  created_at: string;
  thumbnail_url: string;
  view_count: number;
  stream_id: string | null;
}

interface TwitchVodResponse {
  data: TwitchVod[];
  pagination: { cursor?: string };
}

/** Parse Twitch duration string ("3h14m22s") to total seconds */
export function parseTwitchDuration(dur: string): number {
  let total = 0;
  const h = dur.match(/(\d+)h/);
  const m = dur.match(/(\d+)m/);
  const s = dur.match(/(\d+)s/);
  if (h) total += parseInt(h[1]) * 3600;
  if (m) total += parseInt(m[1]) * 60;
  if (s) total += parseInt(s[1]);
  return total;
}

/** Build a usable thumbnail URL from Twitch's template */
function buildThumbnail(template: string): string {
  return template.replace("%{width}", "640").replace("%{height}", "360");
}

/**
 * Fetch VODs for a Twitch user using the Helix API.
 */
export async function fetchTwitchVods(
  twitchUserId: string,
  accessToken: string,
  limit = 20
): Promise<TwitchVod[]> {
  const clientId = process.env.TWITCH_CLIENT_ID!;
  const vods: TwitchVod[] = [];
  let cursor: string | undefined;

  while (vods.length < limit) {
    const params = new URLSearchParams({
      user_id: twitchUserId,
      first: Math.min(limit - vods.length, 20).toString(),
    });
    if (cursor) params.set("after", cursor);

    const res = await fetch(`${HELIX_BASE}/videos?${params}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Client-Id": clientId,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Twitch API ${res.status}: ${body}`);
    }

    const json: TwitchVodResponse = await res.json();
    vods.push(...json.data);

    if (!json.pagination.cursor || json.data.length === 0) break;
    cursor = json.pagination.cursor;
  }

  return vods;
}

export interface VodDownloadResult {
  filePath: string;
  segmentStartSeconds: number; // actual start time of first downloaded segment
  cleanup: () => Promise<void>;
}

/**
 * Download a Twitch VOD audio stream to a temp file on disk.
 *
 * Returns a filePath + cleanup function instead of a Buffer.
 * This avoids loading the entire VOD into memory (which crashes on large streams).
 * Callers MUST call cleanup() when done — even on error.
 *
 * Segments are downloaded with a per-segment timeout to prevent hangs.
 */

/**
 * Get the audio-only M3U8 URL for a Twitch VOD without downloading it.
 * Used by Deepgram URL transcription to avoid downloading to disk.
 */
export async function getTwitchVodAudioUrl(vodId: string, twitchUserToken?: string): Promise<string> {
  // Use the web player's anonymous client ID — the same one yt-dlp, streamlink,
  // and TwitchDownloader use. Twitch's internal GQL rejects App Access Tokens
  // (client_credentials) with 400; the only thing it accepts for PlaybackAccessToken
  // is the web player client ID (optionally with a user OAuth token for sub-only VODs).
  const GQL_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";
  const gqlHeaders: Record<string, string> = {
    "Client-Id": GQL_CLIENT_ID,
    "Content-Type": "application/json",
  };

  const gqlRes = await fetch("https://gql.twitch.tv/gql", {
    method: "POST",
    headers: gqlHeaders,
    body: JSON.stringify({
      operationName: "PlaybackAccessToken",
      query: `query PlaybackAccessToken($vodID: ID!, $playerType: String!) {
        videoPlaybackAccessToken(id: $vodID, params: {platform: "web", playerBackend: "mediaplayer", playerType: $playerType}) {
          value
          signature
        }
      }`,
      variables: { vodID: vodId, playerType: "site" },
    }),
  });

  if (!gqlRes.ok) {
    const body = await gqlRes.text();
    console.error(`[twitch] getTwitchVodAudioUrl GQL ${gqlRes.status}: ${body.slice(0, 400)}`);
    if (gqlRes.status === 401) throw new TwitchAuthError();
    throw new Error(`Twitch GQL failed: ${gqlRes.status}`);
  }

  const gqlData = await gqlRes.json();
  if (gqlData.errors?.length) {
    console.error(`[twitch] getTwitchVodAudioUrl GQL errors:`, JSON.stringify(gqlData.errors).slice(0, 400));
  }
  const token = gqlData.data?.videoPlaybackAccessToken;
  if (!token) throw new Error("Twitch did not return a playback token — the VOD may be deleted, subscriber-only, or Twitch's API may be temporarily down. Try again in a few minutes.");

  const usherParams = new URLSearchParams({
    allow_source: "true",
    allow_audio_only: "true",
    allow_spectre: "true",
    player: "twitchweb",
    playlist_include_framerate: "true",
    sig: token.signature,
    token: token.value,
  });

  const masterUrl = `https://usher.ttvnw.net/vod/${vodId}.m3u8?${usherParams}`;
  const masterRes = await fetch(masterUrl);
  if (!masterRes.ok) throw new Error(`Usher failed: ${masterRes.status}`);

  const lines = (await masterRes.text()).split("\n");

  let streamUrl = "";
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("audio_only") || lines[i].includes('VIDEO="audio_only"')) {
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim() && !lines[j].startsWith("#")) {
          streamUrl = lines[j].trim();
          break;
        }
      }
      break;
    }
  }

  if (!streamUrl) {
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line && !line.startsWith("#") && line.startsWith("http")) {
        streamUrl = line;
        break;
      }
    }
  }

  if (!streamUrl) throw new Error("No stream URL found");
  return streamUrl;
}

/**
 * Download only the segments of a Twitch VOD needed for a clip.
 * Instead of downloading the entire VOD (which fills Vercel's 512MB /tmp),
 * we parse segment durations from the M3U8 playlist and only download
 * the segments that cover [startSeconds - 10, endSeconds + 10].
 *
 * Returns filePath, segmentStartSeconds (the actual start time of the first
 * downloaded segment — used to adjust FFmpeg timestamps), and a cleanup function.
 */
export async function downloadTwitchVodAudio(
  vodId: string,
  startSeconds: number,
  endSeconds: number
): Promise<VodDownloadResult> {
  const GQL_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";

  // Step 1: Get playback access token via GQL
  const gqlRes = await fetch("https://gql.twitch.tv/gql", {
    method: "POST",
    headers: { "Client-Id": GQL_CLIENT_ID, "Content-Type": "application/json" },
    body: JSON.stringify({
      operationName: "PlaybackAccessToken",
      query: `query PlaybackAccessToken($vodID: ID!, $playerType: String!) {
        videoPlaybackAccessToken(id: $vodID, params: {platform: "web", playerBackend: "mediaplayer", playerType: $playerType}) {
          value
          signature
        }
      }`,
      variables: { vodID: vodId, playerType: "site" },
    }),
  });

  if (!gqlRes.ok) {
    if (gqlRes.status === 401) throw new TwitchAuthError();
    throw new Error(`Twitch GQL failed: ${gqlRes.status}`);
  }
  const gqlData = await gqlRes.json();
  const token = gqlData.data?.videoPlaybackAccessToken;
  if (!token) throw new Error("Twitch did not return a playback token — the VOD may be deleted, subscriber-only, or Twitch's API may be temporarily down. Try again in a few minutes.");

  // Step 2: Get M3U8 master playlist
  const usherParams = new URLSearchParams({
    allow_source: "true",
    allow_audio_only: "true",
    allow_spectre: "true",
    player: "twitchweb",
    playlist_include_framerate: "true",
    sig: token.signature,
    token: token.value,
  });

  const masterRes = await fetch(`https://usher.ttvnw.net/vod/${vodId}.m3u8?${usherParams}`);
  if (!masterRes.ok) throw new Error(`Usher failed: ${masterRes.status}`);

  const masterLines = (await masterRes.text()).split("\n");
  let streamUrl = "";
  for (let i = 0; i < masterLines.length; i++) {
    if (masterLines[i].includes("audio_only") || masterLines[i].includes('VIDEO="audio_only"')) {
      for (let j = i + 1; j < masterLines.length; j++) {
        if (masterLines[j].trim() && !masterLines[j].startsWith("#")) {
          streamUrl = masterLines[j].trim();
          break;
        }
      }
      break;
    }
  }
  if (!streamUrl) {
    for (let i = masterLines.length - 1; i >= 0; i--) {
      const line = masterLines[i].trim();
      if (line && !line.startsWith("#") && line.startsWith("http")) { streamUrl = line; break; }
    }
  }
  if (!streamUrl) throw new Error("No stream URL found in master playlist");

  // Step 3: Parse sub-playlist — collect all segment URLs in order
  const subRes = await fetch(streamUrl);
  if (!subRes.ok) throw new Error(`Sub-playlist fetch failed: ${subRes.status}`);

  const subText = await subRes.text();
  const baseUrl = streamUrl.substring(0, streamUrl.lastIndexOf("/") + 1);

  // Collect all segment URLs — skip any # comment/tag lines
  const allSegmentUrls = subText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => (l.startsWith("http") ? l : baseUrl + l));

  if (allSegmentUrls.length === 0) throw new Error("No segments found in playlist");

  // Step 4: Use index-based slicing — Twitch segments are reliably ~10s each.
  // This avoids fragile EXTINF duration parsing which breaks with extra M3U8 tags.
  const SEG_DURATION = 10;
  const startIdx = Math.max(0, Math.floor(startSeconds / SEG_DURATION) - 2);
  const endIdx = Math.min(allSegmentUrls.length - 1, Math.ceil(endSeconds / SEG_DURATION) + 2);

  const needed = allSegmentUrls.slice(startIdx, endIdx + 1);
  const segmentStartSeconds = startIdx * SEG_DURATION;

  console.log(`[twitch] Downloading segments ${startIdx}-${endIdx} of ${allSegmentUrls.length} for clip (peak: ${Math.round(startSeconds)}s-${Math.round(endSeconds)}s)`);

  // Step 5: Write only the needed segments to a temp file
  const tempDir = await mkdtemp(join(tmpdir(), "levlcast-clip-"));
  const filePath = join(tempDir, "audio.ts");
  const writeStream = createWriteStream(filePath);

  const cleanup = async () => {
    try { await unlink(filePath); } catch {}
    try { await rmdir(tempDir); } catch {}
  };

  try {
    for (const segUrl of needed) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const segRes = await fetch(segUrl, { signal: controller.signal });
        if (!segRes.ok) continue;
        const buf = Buffer.from(await segRes.arrayBuffer());
        await new Promise<void>((resolve, reject) => {
          writeStream.write(buf, (err) => (err ? reject(err) : resolve()));
        });
      } catch (err: any) {
        if (err.name === "AbortError") {
          console.warn(`[twitch] Segment timeout, skipping: ${segUrl}`);
          continue;
        }
        throw err;
      } finally {
        clearTimeout(timeout);
      }
    }

    await new Promise<void>((resolve, reject) => {
      writeStream.end((err: any) => (err ? reject(err) : resolve()));
    });

    console.log(`[twitch] Clip segments written to disk: ${filePath}`);
    return { filePath, segmentStartSeconds, cleanup };
  } catch (err) {
    writeStream.destroy();
    await cleanup();
    throw err;
  }
}

/**
 * Parse an M3U8 sub-playlist into segments with their actual durations.
 * Uses EXTINF tags for accurate cumulative timestamps instead of assuming
 * a fixed segment duration. Falls back to 10s if EXTINF parsing fails.
 */
function parseM3U8Segments(playlistText: string, baseUrl: string): { url: string; duration: number }[] {
  const lines = playlistText.split("\n").map((l) => l.trim());
  const segments: { url: string; duration: number }[] = [];
  let pendingDuration = -1;

  for (const line of lines) {
    if (line.startsWith("#EXTINF:")) {
      const match = line.match(/#EXTINF:([\d.]+)/);
      pendingDuration = match ? parseFloat(match[1]) : 10;
    } else if (line && !line.startsWith("#")) {
      const url = line.startsWith("http") ? line : baseUrl + line;
      segments.push({ url, duration: pendingDuration > 0 ? pendingDuration : 10 });
      pendingDuration = -1;
    }
  }

  return segments;
}

/**
 * Download Twitch VOD VIDEO segments for clip generation.
 * Selects the lowest available video quality (360p or 480p) to keep file sizes
 * small while still capturing actual video frames.
 */
function withTimeout(ms: number): AbortController {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl;
}

export async function downloadTwitchVodVideo(
  vodId: string,
  startSeconds: number,
  endSeconds: number,
  twitchUserToken?: string
): Promise<VodDownloadResult> {
  // Step 1: Get playback access token (15s timeout)
  // Use the web player's anonymous client ID — same as yt-dlp/streamlink/TwitchDownloader.
  // App Access Tokens (client_credentials) return 400 on this internal GQL endpoint.
  // Include the user's OAuth token when available so subscriber-only VODs (including
  // the creator's own content set to subs-only) can be accessed.
  const GQL_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";
  const gqlCtrl = withTimeout(15000);
  const gqlHeaders: Record<string, string> = {
    "Client-Id": GQL_CLIENT_ID,
    "Content-Type": "application/json",
  };
  if (twitchUserToken) {
    gqlHeaders["Authorization"] = `Bearer ${twitchUserToken}`;
  }

  const gqlRes = await fetch("https://gql.twitch.tv/gql", {
    method: "POST",
    headers: gqlHeaders,
    body: JSON.stringify({
      operationName: "PlaybackAccessToken",
      query: `query PlaybackAccessToken($vodID: ID!, $playerType: String!) {
        videoPlaybackAccessToken(id: $vodID, params: {platform: "web", playerBackend: "mediaplayer", playerType: $playerType}) {
          value
          signature
        }
      }`,
      variables: { vodID: vodId, playerType: "site" },
    }),
    signal: gqlCtrl.signal,
  }).catch((err) => { throw new Error(`Twitch GQL token fetch timed out or failed: ${err.message}`); });

  if (!gqlRes.ok) {
    const body = await gqlRes.text();
    console.error(`[twitch] downloadTwitchVodVideo GQL ${gqlRes.status} for VOD ${vodId}: ${body.slice(0, 400)}`);
    if (gqlRes.status === 401) throw new TwitchAuthError();
    throw new Error(`Twitch GQL failed: ${gqlRes.status}`);
  }
  const gqlData = await gqlRes.json();
  if (gqlData.errors?.length) {
    console.error(`[twitch] downloadTwitchVodVideo GQL errors for VOD ${vodId}:`, JSON.stringify(gqlData.errors).slice(0, 400));
  }
  const token = gqlData.data?.videoPlaybackAccessToken;
  if (!token) {
    const authed = !!twitchUserToken;
    console.error(`[twitch] null playback token for VOD ${vodId} (authenticated: ${authed}) — likely subscriber-only or deleted`);
    throw new Error(
      authed
        ? "Twitch did not return a playback token. This VOD may be subscriber-only or has been deleted. Try logging out and back in, then retry."
        : "Twitch did not return a playback token. This VOD may be subscriber-only, deleted, or Twitch's API may be temporarily down. Try again in a few minutes."
    );
  }

  // Step 2: Get M3U8 master playlist (10s timeout)
  const usherParams = new URLSearchParams({
    allow_source: "true",
    allow_audio_only: "true",
    allow_spectre: "true",
    player: "twitchweb",
    playlist_include_framerate: "true",
    sig: token.signature,
    token: token.value,
  });

  const masterCtrl = withTimeout(10000);
  const masterRes = await fetch(`https://usher.ttvnw.net/vod/${vodId}.m3u8?${usherParams}`, { signal: masterCtrl.signal })
    .catch((err) => { throw new Error(`Twitch master playlist fetch timed out: ${err.message}`); });
  if (!masterRes.ok) throw new Error(`Usher failed: ${masterRes.status}`);
  const masterText = await masterRes.text();
  const masterLines = masterText.split("\n");

  // Step 3: Pick best video quality — prefer 480p or 360p, avoid audio_only and source
  // Parse all VIDEO= entries and their URLs
  const qualities: { label: string; resolution: string; url: string }[] = [];
  for (let i = 0; i < masterLines.length; i++) {
    const line = masterLines[i];
    if (line.startsWith("#EXT-X-STREAM-INF")) {
      const videoMatch = line.match(/VIDEO="([^"]+)"/);
      const resMatch = line.match(/RESOLUTION=(\d+x\d+)/);
      const url = masterLines[i + 1]?.trim();
      if (videoMatch && url && !url.startsWith("#")) {
        qualities.push({ label: videoMatch[1], resolution: resMatch?.[1] || "", url });
      }
    }
  }

  // Priority: lowest quality that still has video (smallest segments = faster download)
  // chunked = source quality (1080p60 or higher) — only use as last resort
  // Never pick audio_only
  const videoQualities = qualities.filter((q) => !q.label.includes("audio") && q.label !== "chunked");
  const chunkedQuality = qualities.find((q) => q.label === "chunked");
  const preferred = ["360p30", "360p", "360p60", "480p", "480p60", "720p", "720p60"];
  let streamUrl = "";
  for (const pref of preferred) {
    const match = videoQualities.find((q) => q.label === pref);
    if (match) { streamUrl = match.url; break; }
  }
  // Fallback to any non-chunked non-audio quality (lowest first)
  if (!streamUrl && videoQualities.length > 0) {
    streamUrl = videoQualities[videoQualities.length - 1].url;
  }
  // Last resort: chunked (source quality) — produces large files but works
  if (!streamUrl && chunkedQuality) {
    streamUrl = chunkedQuality.url;
    console.warn("[twitch] No lower-quality stream available — falling back to source (chunked). Segments will be large.");
  }
  if (!streamUrl) throw new Error("No video stream found in master playlist");

  console.log(`[twitch] Using video quality for clip: ${qualities.find((q) => q.url === streamUrl)?.label}`);

  // Step 4: Parse sub-playlist with actual EXTINF durations for accurate seeking (10s timeout)
  const subCtrl = withTimeout(10000);
  const subRes = await fetch(streamUrl, { signal: subCtrl.signal })
    .catch((err) => { throw new Error(`Twitch sub-playlist fetch timed out: ${err.message}`); });
  if (!subRes.ok) throw new Error(`Sub-playlist fetch failed: ${subRes.status}`);
  const subText = await subRes.text();
  const baseUrl = streamUrl.substring(0, streamUrl.lastIndexOf("/") + 1);

  const parsedSegments = parseM3U8Segments(subText, baseUrl);

  if (parsedSegments.length === 0) throw new Error("No segments found in playlist");

  // Step 5: Find segments by cumulative time instead of assuming fixed 10s duration.
  // This prevents timestamp drift on long VODs where segments vary slightly.
  let cumulative = 0;
  const segTimestamps: number[] = []; // cumulative start time of each segment
  for (const seg of parsedSegments) {
    segTimestamps.push(cumulative);
    cumulative += seg.duration;
  }

  // Find first segment that starts before our target (with 2-segment buffer)
  let startIdx = 0;
  for (let i = 0; i < segTimestamps.length; i++) {
    if (segTimestamps[i] + parsedSegments[i].duration >= startSeconds) {
      startIdx = Math.max(0, i - 2);
      break;
    }
  }
  // Find last segment that covers our end time (with 2-segment buffer)
  let endIdx = parsedSegments.length - 1;
  for (let i = startIdx; i < segTimestamps.length; i++) {
    if (segTimestamps[i] >= endSeconds) {
      endIdx = Math.min(parsedSegments.length - 1, i + 2);
      break;
    }
  }

  const needed = parsedSegments.slice(startIdx, endIdx + 1).map((s) => s.url);
  const segmentStartSeconds = segTimestamps[startIdx];

  console.log(`[twitch] Downloading video segments ${startIdx}-${endIdx} of ${parsedSegments.length} (offset: ${segmentStartSeconds.toFixed(1)}s)`);

  const tempDir = await mkdtemp(join(tmpdir(), "levlcast-clip-"));
  const filePath = join(tempDir, "video.ts");
  const writeStream = createWriteStream(filePath);

  const cleanup = async () => {
    try { await unlink(filePath); } catch {}
    try { await rmdir(tempDir); } catch {}
  };

  // Fetch one segment with up to 3 attempts on transient failure / timeout.
  // 12s timeout per attempt keeps total worst-case per segment to ~36s.
  // Returns null if all attempts fail — caller decides whether missing segments are fatal.
  async function fetchSegment(url: string, attempt = 1): Promise<Buffer | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        if (attempt < 3) return fetchSegment(url, attempt + 1);
        return null;
      }
      return Buffer.from(await res.arrayBuffer());
    } catch (err: any) {
      if (attempt < 3) {
        console.warn(`[twitch] Segment attempt ${attempt} failed (${err.name === "AbortError" ? "timeout" : err.message}), retrying: ${url}`);
        return fetchSegment(url, attempt + 1);
      }
      console.warn(`[twitch] Segment failed after ${attempt} attempts (${err.name === "AbortError" ? "timeout" : err.message}): ${url}`);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  try {
    // Parallel download with concurrency limit so we don't hammer Twitch CDN
    // while still cutting total wall time from N×20s sequential to ~max(segment).
    // Results MUST preserve input order — TS segments concatenate into one
    // contiguous stream and reordering breaks FFmpeg decoding.
    const CONCURRENCY = 8;
    const buffers: (Buffer | null)[] = new Array(needed.length).fill(null);
    let next = 0;

    async function worker() {
      while (true) {
        const i = next++;
        if (i >= needed.length) return;
        buffers[i] = await fetchSegment(needed[i]);
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

    const missing = buffers.filter((b) => b === null).length;
    if (missing > 0) {
      const missingPct = (missing / buffers.length) * 100;
      console.warn(`[twitch] ${missing}/${buffers.length} segments missing (${missingPct.toFixed(0)}%)`);
      // Even one missing segment creates an MPEG-TS timestamp gap that
      // FFmpeg's encoder can't recover from cleanly — produces the
      // time=-577014:32:22.77 PTS rollover errors and zero-frame outputs.
      // Tolerate at most 5% missing (effectively 0-1 segments for typical
      // 7-segment clip windows); above that, fail and let the user retry.
      if (missingPct > 5) {
        throw new Error(`Twitch CDN dropped ${missing}/${buffers.length} segments (${missingPct.toFixed(0)}%) — clip would have timestamp gaps that break encoding. Try Regenerate; if it persists, the VOD source is incomplete.`);
      }
    }

    // Write buffers to disk in original segment order.
    for (const buf of buffers) {
      if (!buf) continue;
      await new Promise<void>((resolve, reject) => {
        writeStream.write(buf, (err) => (err ? reject(err) : resolve()));
      });
    }

    await new Promise<void>((resolve, reject) => {
      writeStream.end((err: any) => (err ? reject(err) : resolve()));
    });

    console.log(`[twitch] Video segments written to disk: ${filePath} (${buffers.length - missing}/${buffers.length} ok)`);
    return { filePath, segmentStartSeconds, cleanup };
  } catch (err) {
    writeStream.destroy();
    await cleanup();
    throw err;
  }
}

/**
 * Stream Twitch VOD audio segments directly into a PassThrough — no disk writes.
 * The returned PassThrough is written to in the background; pass it straight to
 * transcribePassThrough() so Deepgram receives data as it downloads.
 */
export function streamTwitchVodAudio(vodId: string, twitchUserToken?: string): PassThrough {
  const passThrough = new PassThrough();

  (async () => {
    // Anonymous web player client ID — same approach as yt-dlp/streamlink.
    // App Access Tokens (client_credentials) are rejected with 400 by this endpoint.
    // Include user token if available so subscriber-only VODs can be transcribed.
    const GQL_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";
    const streamGqlHeaders: Record<string, string> = { "Client-Id": GQL_CLIENT_ID, "Content-Type": "application/json" };
    if (twitchUserToken) streamGqlHeaders["Authorization"] = `Bearer ${twitchUserToken}`;
    const gqlRes = await fetch("https://gql.twitch.tv/gql", {
      method: "POST",
      headers: streamGqlHeaders,
      body: JSON.stringify({
        operationName: "PlaybackAccessToken",
        query: `query PlaybackAccessToken($vodID: ID!, $playerType: String!) {
          videoPlaybackAccessToken(id: $vodID, params: {platform: "web", playerBackend: "mediaplayer", playerType: $playerType}) {
            value
            signature
          }
        }`,
        variables: { vodID: vodId, playerType: "site" },
      }),
    });

    if (!gqlRes.ok) {
      const body = await gqlRes.text();
      console.error(`[twitch] streamTwitchVodAudio GQL ${gqlRes.status} for VOD ${vodId}: ${body.slice(0, 400)}`);
      if (gqlRes.status === 401) throw new TwitchAuthError();
      throw new Error(`Twitch GQL failed: ${gqlRes.status}`);
    }
    const gqlData = await gqlRes.json();
    if (gqlData.errors?.length) {
      console.error(`[twitch] streamTwitchVodAudio GQL errors for VOD ${vodId}:`, JSON.stringify(gqlData.errors).slice(0, 400));
    }
    const token = gqlData.data?.videoPlaybackAccessToken;
    if (!token) throw new Error("Twitch did not return a playback token — the VOD may be deleted, subscriber-only, or Twitch's API may be temporarily down. Try again in a few minutes.");

    const usherParams = new URLSearchParams({
      allow_source: "true",
      allow_audio_only: "true",
      allow_spectre: "true",
      player: "twitchweb",
      playlist_include_framerate: "true",
      sig: token.signature,
      token: token.value,
    });

    const masterRes = await fetch(`https://usher.ttvnw.net/vod/${vodId}.m3u8?${usherParams}`);
    if (!masterRes.ok) throw new Error(`Usher failed: ${masterRes.status}`);

    const lines = (await masterRes.text()).split("\n");
    let streamUrl = "";
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("audio_only") || lines[i].includes('VIDEO="audio_only"')) {
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].trim() && !lines[j].startsWith("#")) {
            streamUrl = lines[j].trim();
            break;
          }
        }
        break;
      }
    }
    if (!streamUrl) {
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (line && !line.startsWith("#") && line.startsWith("http")) {
          streamUrl = line;
          break;
        }
      }
    }
    if (!streamUrl) throw new Error("No stream URL found");

    const subRes = await fetch(streamUrl);
    if (!subRes.ok) throw new Error(`Sub-playlist fetch failed: ${subRes.status}`);
    const baseUrl = streamUrl.substring(0, streamUrl.lastIndexOf("/") + 1);
    const segmentUrls = (await subRes.text())
      .split("\n")
      .filter((l) => l.trim() && !l.startsWith("#"))
      .map((l) => (l.trim().startsWith("http") ? l.trim() : baseUrl + l.trim()));

    if (segmentUrls.length === 0) throw new Error("No segments found");

    console.log(`[twitch] Streaming ${segmentUrls.length} segments to Deepgram`);

    // Each segment gets 3 attempts with linear backoff. If we exhaust
    // retries we THROW rather than silently skip — silent skips quietly
    // shift every subsequent Deepgram word timestamp earlier than the
    // real audio (each skipped segment = N seconds of accumulated drift),
    // which manifests as captions appearing before they're spoken in
    // the rendered clip. Aligned-or-fail beats silently-misaligned.
    for (let i = 0; i < segmentUrls.length; i++) {
      const url = segmentUrls[i];
      let success = false;
      let lastErr: unknown = null;

      for (let attempt = 0; attempt < 3 && !success; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 500 * attempt));

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        try {
          const segRes = await fetch(url, { signal: controller.signal });
          if (!segRes.ok) {
            lastErr = new Error(`HTTP ${segRes.status}`);
            continue;
          }
          const buf = Buffer.from(await segRes.arrayBuffer());
          passThrough.write(buf);
          success = true;
        } catch (err) {
          lastErr = err;
        } finally {
          clearTimeout(timeout);
        }
      }

      if (!success) {
        const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
        throw new Error(
          `Audio segment ${i + 1}/${segmentUrls.length} failed after 3 retries — ${msg}. ` +
          `Skipping it would misalign every subsequent caption timestamp; please retry.`
        );
      }
    }

    passThrough.end();
  })().catch((err) => passThrough.destroy(err));

  return passThrough;
}

// ─── Chat Replay ────────────────────────────────────────────────────────────

export interface ChatMessage {
  /** Seconds since the start of the VOD when the message was posted */
  time: number;
  /** Username (login). Used for unique-chatter counts; not stored long-term. */
  user: string;
  /** Plain-text message body (badges/emote metadata stripped) */
  text: string;
  /** Twitch internal message ID (used for de-duplication during paging) */
  id: string;
}

/**
 * Fetch the full chat replay for a public VOD via Twitch's internal GQL
 * (the same endpoint the web player uses for chat replay). Twitch GQL is
 * undocumented but stable across major chat-archive tools — pagination is
 * cursor-based and stops when hasNextPage is false.
 *
 * Caps at maxMessages (default 50k) to keep memory bounded for very long
 * VODs. A 4-hour stream typically has 5-15k messages depending on size.
 *
 * Returns [] (not throw) on transient failures so caller can keep going
 * without chat — chat data is best-effort, not load-bearing.
 */
export async function fetchTwitchVodChat(
  vodId: string,
  options: { maxMessages?: number; signal?: AbortSignal } = {}
): Promise<ChatMessage[]> {
  const maxMessages = options.maxMessages ?? 50_000;
  const GQL_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";

  const messages: ChatMessage[] = [];
  let cursor: string | null = null;
  let pageCount = 0;
  const MAX_PAGES = 1500; // sanity cap (~150k messages at 100/page)

  while (pageCount < MAX_PAGES) {
    pageCount++;

    const variables: Record<string, unknown> = { videoID: vodId };
    if (cursor) {
      variables.cursor = cursor;
    } else {
      variables.contentOffsetSeconds = 0;
    }

    const body = [{
      operationName: "VideoCommentsByOffsetOrCursor",
      variables,
      extensions: {
        persistedQuery: {
          version: 1,
          // Persisted query hash used by every chat-replay tool that scrapes
          // Twitch (TwitchDownloader, ChatDownloader, etc.). Stable for years.
          sha256Hash: "b70a3591ff0f4e0313d126c6a1502d79a1c02baebb288227c582044aa76adf6a",
        },
      },
    }];

    // Retry transient failures (5xx, network errors) up to 2 times before
    // bailing on this page. Bailing the whole fetch on one flake means the
    // user sees an empty pulse for what would otherwise be a great stream.
    let res: Response | null = null;
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 500 * attempt));
      try {
        const r = await fetch("https://gql.twitch.tv/gql", {
          method: "POST",
          headers: { "Client-Id": GQL_CLIENT_ID, "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: options.signal,
        });
        if (r.ok) { res = r; break; }
        if (r.status >= 400 && r.status < 500) {
          // Client errors won't get better with retry — log and stop paging
          console.warn(`[twitch chat] GQL ${r.status} on page ${pageCount} (client error, stopping)`);
          return messages;
        }
        lastErr = new Error(`HTTP ${r.status}`);
      } catch (err) {
        lastErr = err;
      }
    }
    if (!res) {
      console.warn(`[twitch chat] Page ${pageCount} failed after retries:`, lastErr);
      break;
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch (err) {
      console.warn(`[twitch chat] JSON parse failed on page ${pageCount}:`, err);
      break;
    }

    // Surface GraphQL errors — without this a stale persisted-query hash
    // returns errors: [...] with empty data and we'd silently get zero chat.
    type GqlError = { message?: string };
    const maybeErrs = (Array.isArray(json) ? json[0] : json) as { errors?: GqlError[] };
    if (maybeErrs?.errors && maybeErrs.errors.length > 0) {
      console.warn(`[twitch chat] GQL errors on page ${pageCount}:`, maybeErrs.errors.map((e) => e.message).join("; "));
      // If first page has errors, the whole fetch is doomed (likely stale
      // persisted-query hash). Stop and return whatever we have.
      if (pageCount === 1) return messages;
    }

    type CommentEdge = {
      cursor: string;
      node: {
        id: string;
        contentOffsetSeconds: number;
        message?: { fragments?: Array<{ text?: string }> };
        commenter?: { login?: string; displayName?: string } | null;
      };
    };
    type CommentsPayload = {
      data?: {
        video?: {
          comments?: {
            edges?: CommentEdge[];
            pageInfo?: { hasNextPage?: boolean };
          };
        };
      };
    };

    // Persisted-query response is wrapped in a single-element array
    const payload = (Array.isArray(json) ? json[0] : json) as CommentsPayload;
    const comments = payload?.data?.video?.comments;
    const edges = comments?.edges ?? [];
    const hasNext = comments?.pageInfo?.hasNextPage ?? false;

    // Empty edges + no next page → genuinely done. Empty edges + next page
    // means a transient hiccup; we can't advance the cursor without an edge,
    // so bail rather than infinite-loop.
    if (edges.length === 0) {
      if (hasNext) {
        console.warn(`[twitch chat] Empty page ${pageCount} with hasNextPage=true (no cursor to advance) — stopping`);
      }
      break;
    }

    for (const edge of edges) {
      const n = edge.node;
      const text = (n.message?.fragments ?? [])
        .map((f) => f.text ?? "")
        .join("")
        .trim();
      if (!text) continue;
      messages.push({
        time: n.contentOffsetSeconds,
        user: n.commenter?.login ?? n.commenter?.displayName ?? "anonymous",
        text,
        id: n.id,
      });
    }

    if (messages.length >= maxMessages) {
      console.warn(`[twitch chat] Hit message cap ${maxMessages}, stopping`);
      break;
    }

    if (!hasNext) break;
    const nextCursor = edges[edges.length - 1].cursor;
    if (!nextCursor || nextCursor === cursor) {
      // Cursor didn't advance — would loop forever otherwise
      console.warn(`[twitch chat] Cursor failed to advance on page ${pageCount} — stopping`);
      break;
    }
    cursor = nextCursor;
  }

  console.log(`[twitch chat] Fetched ${messages.length} messages across ${pageCount} pages for VOD ${vodId}`);
  return messages;
}

/** Convert a raw Twitch VOD into the shape we store in Supabase */
export function mapVodToRow(vod: TwitchVod, userId: string) {
  return {
    user_id: userId,
    twitch_vod_id: vod.id,
    title: vod.title,
    duration_seconds: parseTwitchDuration(vod.duration),
    thumbnail_url: buildThumbnail(vod.thumbnail_url),
    stream_date: vod.created_at,
    status: "pending" as const,
  };
}
