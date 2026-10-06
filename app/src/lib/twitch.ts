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
 *
 * Pass `forceRefresh: true` to bust the cache. Use this when a downstream
 * Twitch call returns 401 — Twitch invalidates ALL previously-issued app
 * access tokens when the client secret is rotated, but the cached `expiresAt`
 * in this module doesn't know about that. The result is a stale cached token
 * that 401s on every use until module-instance death. Loco_Flare hit exactly
 * this on 2026-05-24 right after we rotated the secret.
 */
export async function getAppAccessToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedAppToken && Date.now() < cachedAppToken.expiresAt) {
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

/** Invalidate the in-memory app-token cache. Call after a Twitch call returns 401. */
export function invalidateAppTokenCache() {
  cachedAppToken = null;
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
      // Only past broadcasts. Without this Helix mixes in highlights and
      // uploads, which can push recent archives out of the first 40 results
      // for streamers who have many highlights or clip uploads — exactly
      // why some users were missing their last 1-2 streams from sync.
      type: "archive",
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
  if (!token) throw new Error("Twitch is blocking access to this VOD, so it cannot be analyzed. This happens when a stream is set to subscriber-only, gets muted or flagged for background music (DMCA), or has expired from Twitch storage. To fix it, open your Twitch Creator Dashboard, go to Content then Video Producer, and set this VOD to Public. Then hit Analyze again. If it already expired, it cannot be recovered.");

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
  if (!token) throw new Error("Twitch is blocking access to this VOD, so it cannot be analyzed. This happens when a stream is set to subscriber-only, gets muted or flagged for background music (DMCA), or has expired from Twitch storage. To fix it, open your Twitch Creator Dashboard, go to Content then Video Producer, and set this VOD to Public. Then hit Analyze again. If it already expired, it cannot be recovered.");

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
  // Do NOT send the user OAuth token — it was issued to our developer client ID, not the
  // web player client ID, so Twitch ignores it and returns null for subscriber-only VODs
  // instead of granting access. Pure anonymous works for all public VODs.
  const GQL_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";
  const gqlCtrl = withTimeout(15000);
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
    console.error(`[twitch] null playback token for VOD ${vodId}: subscriber-only, deleted, or DMCA-restricted`);
    throw new Error(
      "Twitch is blocking access to this VOD, so it can't be analyzed. This happens when a stream is set to subscriber-only, gets muted or flagged for background music (DMCA), or has expired from Twitch's storage. " +
      "To fix it, open your Twitch Creator Dashboard, go to Content then Video Producer, and set this VOD to Public. Then hit Analyze again. If it already expired, it can't be recovered."
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
        throw new Error(`Twitch CDN dropped ${missing}/${buffers.length} segments (${missingPct.toFixed(0)}%). The clip would have timestamp gaps that break encoding. Try Regenerate; if it persists, the VOD source is incomplete.`);
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
    // App Access Tokens (client_credentials) are rejected with 400 on this endpoint.
    // Our developer OAuth tokens cause null responses (client ID mismatch) for subscriber-only
    // content, so we stay pure anonymous — works for all public VODs.
    const GQL_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";
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
    if (!token) throw new Error("Twitch is blocking access to this VOD, so it cannot be analyzed. This happens when a stream is set to subscriber-only, gets muted or flagged for background music (DMCA), or has expired from Twitch storage. To fix it, open your Twitch Creator Dashboard, go to Content then Video Producer, and set this VOD to Public. Then hit Analyze again. If it already expired, it cannot be recovered.");

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
          `Audio segment ${i + 1}/${segmentUrls.length} failed after 3 retries. ${msg}. ` +
          `Skipping it would misalign every subsequent caption timestamp; please retry.`
        );
      }
    }

    passThrough.end();
  })().catch((err) => passThrough.destroy(err));

  return passThrough;
}

export interface VodSegmentList {
  urls: string[];
  /** VOD-relative start time (seconds) of each segment, from #EXTINF cumulative sum */
  startTimes: number[];
  /**
   * Init segment bytes for fMP4 streams (contains the ftyp + moov boxes
   * with codec/timescale metadata). Required at the start of every Deepgram
   * POST that carries fMP4 media fragments — without it the fragments are
   * undecodable. Null for legacy MPEG-TS streams which are self-describing.
   * Stored as a base64 string so it serializes cleanly through Inngest's
   * step state (Inngest serializes step return values as JSON).
   */
  initSegmentBase64?: string | null;
  /**
   * Parallel to urls: true where Twitch muted the segment. Twitch mutes VOD
   * audio in blocks when it detects copyrighted music and serves those
   * segments as "<n>-muted.ts" / "<n>-muted.mp4", which are digital silence
   * (about -91 dB). Nearly every VOD has some. Optional because step state
   * saved by older deploys doesn't carry it.
   */
  muted?: boolean[];
}

/** "<n>-muted.ts" / "<n>-muted.mp4", with or without a query string. */
const MUTED_SEGMENT = /-muted\.(ts|mp4|m4s)(\?|$)/;

/**
 * Fetch the full segment list from a Twitch VOD's audio-only HLS playlist.
 * Returns segment URLs and their VOD-relative start times so callers can
 * slice the list into time-bounded chunks without re-fetching the M3U8.
 */
export async function getTwitchVodSegmentList(vodId: string): Promise<VodSegmentList> {
  const GQL_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";
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
    const body = await gqlRes.text();
    throw new Error(`Twitch GQL failed: ${gqlRes.status} — ${body.slice(0, 200)}`);
  }
  const gqlData = await gqlRes.json();
  const token = gqlData.data?.videoPlaybackAccessToken;
  if (!token) {
    throw new Error(
      "Twitch is blocking access to this VOD, so it can't be analyzed. This happens when a stream is set to subscriber-only, gets muted or flagged for background music (DMCA), or has expired from Twitch's storage. " +
      "To fix it, open your Twitch Creator Dashboard, go to Content then Video Producer, and set this VOD to Public. Then hit Analyze again. If it already expired, it can't be recovered."
    );
  }

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
  if (!streamUrl) throw new Error("No audio stream found in Twitch VOD");

  const subRes = await fetch(streamUrl);
  if (!subRes.ok) throw new Error(`Sub-playlist fetch failed: ${subRes.status}`);
  const baseUrl = streamUrl.substring(0, streamUrl.lastIndexOf("/") + 1);
  const subLines = (await subRes.text()).split("\n");

  // #EXT-X-MAP:URI="init.m4s" points to the fMP4 init segment. Twitch sets
  // this when serving newer VODs as fragmented MP4. Legacy MPEG-TS VODs
  // don't have it. Format: #EXT-X-MAP:URI="<url-or-path>"[,BYTERANGE="..."]
  let initSegmentUrl: string | null = null;
  for (const raw of subLines) {
    const line = raw.trim();
    if (!line.startsWith("#EXT-X-MAP")) continue;
    const m = line.match(/URI="([^"]+)"/);
    if (m && m[1]) {
      const u = m[1];
      initSegmentUrl = u.startsWith("http") ? u : baseUrl + u;
      break;
    }
  }

  const urls: string[] = [];
  const startTimes: number[] = [];
  const muted: boolean[] = [];
  let cursor = 0;

  for (let i = 0; i < subLines.length; i++) {
    const line = subLines[i].trim();
    if (line.startsWith("#EXTINF:")) {
      const dur = parseFloat(line.slice(8));
      for (let j = i + 1; j < subLines.length; j++) {
        let seg = subLines[j].trim();
        if (!seg || seg.startsWith("#")) continue;
        // Some playlists name a muted segment "-unmuted", which 403s. The
        // playable file is the "-muted" one.
        seg = seg.replace(/-unmuted\.(ts|mp4|m4s)/, "-muted.$1");
        urls.push(seg.startsWith("http") ? seg : baseUrl + seg);
        muted.push(MUTED_SEGMENT.test(seg));
        startTimes.push(cursor);
        cursor += isNaN(dur) ? 0 : dur;
        i = j;
        break;
      }
    }
  }

  if (urls.length === 0) throw new Error("No segments found in VOD playlist");

  // Download the init segment once. We base64-encode it so Inngest can
  // safely persist it as part of step state (JSON-serialized) without
  // truncation or binary-encoding issues. A typical init segment is a
  // few KB, so the base64 overhead is negligible compared to the audio
  // segment list (~hundreds of KB for long VODs).
  let initSegmentBase64: string | null = null;
  if (initSegmentUrl) {
    const initRes = await fetch(initSegmentUrl);
    if (!initRes.ok) {
      throw new Error(
        `Failed to fetch fMP4 init segment (HTTP ${initRes.status}). ` +
        `Twitch served an fMP4 playlist but the init segment is unavailable, ` +
        `so we cannot decode the media fragments. Please retry.`
      );
    }
    const initBuf = Buffer.from(await initRes.arrayBuffer());
    if (initBuf.length === 0) {
      throw new Error("fMP4 init segment was empty. Please retry.");
    }
    initSegmentBase64 = initBuf.toString("base64");
    console.log(`[twitch] init segment loaded: ${initBuf.length} bytes (fMP4 VOD)`);
  }

  const mutedCount = muted.filter(Boolean).length;
  console.log(
    `[twitch] segment list: ${urls.length} segments, ~${Math.round(cursor)}s for VOD ${vodId}${initSegmentBase64 ? " (fMP4)" : " (MPEG-TS)"}` +
      (mutedCount ? `, ${mutedCount} muted by Twitch` : "")
  );
  return { urls, startTimes, initSegmentBase64, muted };
}

/**
 * Stream a specific list of segment URLs into a PassThrough — no disk writes.
 * Throws on repeated failures rather than silently skipping to prevent
 * caption timestamp drift (each skipped segment shifts all subsequent timestamps).
 *
 * Each segment buffer is validated as MPEG-TS (legacy .ts files) or fMP4
 * (newer .m4s segments — Twitch is migrating VODs to fragmented MP4). A
 * CDN error page returned with 200 OK fails the format check and triggers
 * a retry instead of poisoning Deepgram's decoder.
 *
 * For fMP4 streams, the caller MUST pass the init segment (ftyp + moov)
 * via initSegment so it's written before the media fragments. Without it
 * Deepgram has no way to decode the moof/mdat fragments — the moov box
 * contains the track table, codec config, and timescales.
 */
function looksLikeFmp4(buf: Buffer): boolean {
  // ISO BMFF box header: 4-byte size (uint32 BE) + 4-byte type (ASCII).
  // Validate structurally instead of with a fixed whitelist — Twitch
  // segments include a wide variety of boxes (ftyp, moov, moof, mdat,
  // sidx, styp, free, mfhd, emsg, prft, ...) and any new spec addition
  // would otherwise be misclassified as garbage and trigger a retry loop.
  //
  // Structural rules:
  //   - Buffer is at least 8 bytes (size + type).
  //   - Box size is either 0 (extends to EOF), 1 (largesize follows),
  //     or in [8, INT32_MAX]. Anything else is corrupt.
  //   - Box type is 4 bytes of printable ASCII (letters / digits, plus
  //     the rare hyphen/space that some legacy boxes allow).
  if (buf.length < 8) return false;
  const size = buf.readUInt32BE(0);
  const SANE_MAX = 64 * 1024 * 1024; // 64MB — Twitch segments are far smaller
  if (size !== 0 && size !== 1 && (size < 8 || size > SANE_MAX)) return false;
  for (let i = 4; i < 8; i++) {
    const c = buf[i];
    const isLower = c >= 0x61 && c <= 0x7a; // a-z
    const isUpper = c >= 0x41 && c <= 0x5a; // A-Z
    const isDigit = c >= 0x30 && c <= 0x39; // 0-9
    if (!(isLower || isUpper || isDigit)) return false;
  }
  return true;
}

export function streamSegmentsToPassThrough(
  segmentUrls: string[],
  initSegment?: Buffer | null
): PassThrough {
  const passThrough = new PassThrough();

  (async () => {
    // fMP4: write the init segment FIRST. Every Deepgram POST that carries
    // media fragments needs the moov box at the start of the stream, so we
    // prepend it here even when this function is called per-chunk.
    if (initSegment && initSegment.length > 0) {
      if (!looksLikeFmp4(initSegment)) {
        throw new Error("fMP4 init segment failed magic-byte check. Source may be corrupt.");
      }
      passThrough.write(initSegment);
    }

    for (let i = 0; i < segmentUrls.length; i++) {
      const url = segmentUrls[i];
      let success = false;
      let lastErr: unknown = null;

      for (let attempt = 0; attempt < 4 && !success; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 500 * attempt));
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        try {
          const segRes = await fetch(url, { signal: controller.signal });
          if (!segRes.ok) { lastErr = new Error(`HTTP ${segRes.status}`); continue; }
          const buf = Buffer.from(await segRes.arrayBuffer());
          if (buf.length === 0) { lastErr = new Error("empty segment body"); continue; }
          // Twitch serves VOD audio as either MPEG-TS (legacy, .ts) or
          // fragmented MP4 (.m4s, newer streams). Accept either:
          //   - MPEG-TS: first byte is 0x47 (sync byte, per the spec)
          //   - fMP4: bytes 4-7 are a known ISO BMFF box type
          // Anything else is a CDN error page or junk that would poison
          // Deepgram's decoder, so we retry.
          const isMpegTs = buf[0] === 0x47;
          const isMp4Box = looksLikeFmp4(buf);
          if (!isMpegTs && !isMp4Box) {
            const head = buf.subarray(0, Math.min(8, buf.length)).toString("hex");
            lastErr = new Error(`unrecognized segment format (head=0x${head}, ${buf.length} bytes)`);
            continue;
          }
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
          `Audio segment ${i + 1}/${segmentUrls.length} failed after 4 retries. ${msg}. ` +
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

/** Twitch's web client id and the chat-replay query every chat-archive tool uses. */
const CHAT_GQL_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";
const CHAT_QUERY_HASH = "b70a3591ff0f4e0313d126c6a1502d79a1c02baebb288227c582044aa76adf6a";

type ChatPage = { messages: ChatMessage[]; last: number | null } | { error: string };

/** One page of a VOD's chat around `offset` seconds: about 60 messages, starting a little before it. */
async function fetchChatPage(vodId: string, offset: number, signal?: AbortSignal): Promise<ChatPage> {
  const body = [{
    operationName: "VideoCommentsByOffsetOrCursor",
    variables: { videoID: vodId, contentOffsetSeconds: Math.max(0, Math.floor(offset)) },
    extensions: { persistedQuery: { version: 1, sha256Hash: CHAT_QUERY_HASH } },
  }];
  let lastErr = "no response";
  // Transient failures (5xx, network) get two more tries; a client error won't improve.
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 500 * attempt));
    try {
      const r = await fetch("https://gql.twitch.tv/gql", {
        method: "POST",
        headers: { "Client-Id": CHAT_GQL_CLIENT_ID, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
      if (r.status >= 400 && r.status < 500) return { error: `GQL ${r.status}` };
      if (!r.ok) {
        lastErr = `HTTP ${r.status}`;
        continue;
      }
      const json = (await r.json()) as unknown;
      const first = (Array.isArray(json) ? json[0] : json) as {
        errors?: Array<{ message?: string }>;
        data?: { video?: { comments?: { edges?: Array<{ node: { id: string; contentOffsetSeconds: number; message?: { fragments?: Array<{ text?: string }> }; commenter?: { login?: string; displayName?: string } | null } }> } } };
      };
      if (first?.errors?.length) return { error: first.errors.map((e) => e.message).join("; ") };
      const edges = first?.data?.video?.comments?.edges ?? [];
      const messages: ChatMessage[] = [];
      for (const { node: n } of edges) {
        const text = (n.message?.fragments ?? []).map((x) => x.text ?? "").join("").trim();
        if (!text) continue;
        messages.push({ time: n.contentOffsetSeconds, user: n.commenter?.login ?? n.commenter?.displayName ?? "anonymous", text, id: n.id });
      }
      return { messages, last: edges.length ? edges[edges.length - 1].node.contentOffsetSeconds : null };
    } catch (err) {
      if (signal?.aborted) return { error: "aborted" };
      lastErr = err instanceof Error ? err.message : String(err);
    }
  }
  return { error: lastErr };
}

/**
 * Fetch a public VOD's chat replay through Twitch's internal GQL (what the
 * web player uses for chat replay).
 *
 * Paged by time, not by cursor: Twitch now refuses cursor pages after the
 * first ("failed integrity check"), which left reports with only the first
 * couple of minutes of chat. A page asked for by time comes
 * back as about 60 messages starting a little before that time, so each
 * page starts from the last message of the one before and duplicates are
 * dropped by id. A few workers page separate stretches of the VOD at once,
 * and the whole fetch stops at a time budget, returning what it has.
 *
 * Caps at maxMessages (default 50k) to keep memory bounded. Returns what it
 * got (never throws): chat is best-effort, not load-bearing.
 */
export async function fetchTwitchVodChat(
  vodId: string,
  options: {
    maxMessages?: number;
    signal?: AbortSignal;
    /** Start here, in seconds into the VOD. */
    fromSeconds?: number;
    /** Stop once past this point of the VOD. Without it, one worker reads until chat runs out. */
    untilSeconds?: number;
    /** Give up after this long and return what's in. */
    budgetMs?: number;
    /** Stretches read at once. */
    workers?: number;
  } = {}
): Promise<ChatMessage[]> {
  const maxMessages = options.maxMessages ?? 50_000;
  const from = Math.max(0, options.fromSeconds ?? 0);
  const until = options.untilSeconds;
  const deadline = Date.now() + (options.budgetMs ?? 150_000);
  const MAX_PAGES = 3000;

  const seen = new Set<string>();
  const messages: ChatMessage[] = [];
  let pages = 0;
  let stoppedBy: string | null = null;

  /** Read [a, b) from the start, page after page. b = Infinity reads until chat runs out. */
  const readStretch = async (a: number, b: number) => {
    let offset = a;
    let stall = 0;
    while (offset < b) {
      if (Date.now() > deadline) return void (stoppedBy ??= "time budget");
      if (pages >= MAX_PAGES) return void (stoppedBy ??= "page cap");
      if (messages.length >= maxMessages) return void (stoppedBy ??= "message cap");
      if (options.signal?.aborted) return void (stoppedBy ??= "aborted");
      pages++;
      const page = await fetchChatPage(vodId, offset, options.signal);
      // Past the end of the VOD, Twitch answers "service error": that's the end, not a failure.
      if ("error" in page) return void (page.error !== "service error" && (stoppedBy ??= page.error));
      if (page.last === null) return;
      let fresh = 0;
      for (const m of page.messages) {
        if (seen.has(m.id)) continue;
        seen.add(m.id);
        // Messages from before this stretch belong to the one before it.
        if (m.time < a || m.time >= b) continue;
        messages.push(m);
        fresh++;
      }
      if (page.last >= b) return;
      if (page.last >= offset && fresh > 0) {
        offset = page.last + 1;
        stall = 0;
      } else {
        // Chat so dense the page was all repeats: step ahead a little more each time.
        stall = Math.min(stall + 5, 30);
        offset = Math.max(offset, page.last + 1) + stall;
      }
    }
  };

  if (until === undefined) {
    await readStretch(from, Infinity);
  } else {
    const span = Math.max(0, until - from);
    const n = Math.max(1, Math.min(options.workers ?? 6, Math.ceil(span / 300)));
    const step = span / n;
    await Promise.all(Array.from({ length: n }, (_, i) => readStretch(from + i * step, i === n - 1 ? until : from + (i + 1) * step)));
  }

  messages.sort((x, y) => x.time - y.time);
  if (messages.length > maxMessages) messages.length = maxMessages;
  console.log(`[twitch chat] Fetched ${messages.length} messages in ${pages} pages for VOD ${vodId}${stoppedBy ? ` (stopped early: ${stoppedBy})` : ""}`);
  return messages;
}

/**
 * Twitch sometimes returns nonsensically large durations on the Helix API
 * (we've observed values like "873h22m33s" on VODs from normal-length
 * streams). Twitch's documented max VOD length is 48 hours. Anything
 * larger is broken metadata and would blow up downstream cost/cap math,
 * so we treat it as a sync-time veto: mapVodToRow returns null and the
 * caller filters it out before insert.
 *
 * Lower bound: Twitch sometimes auto-saves 0-15 second stubs when a
 * stream aborts immediately. The AI analysis pipeline produces
 * hallucinated low-confidence reports on those because there's nothing
 * to actually score. Sub-5-min VODs never make it into the user's list.
 */
const MAX_PLAUSIBLE_VOD_SECONDS = 48 * 3600;
const MIN_ANALYZABLE_VOD_SECONDS = 5 * 60; // 5 minutes — see analyze route

/** Convert a raw Twitch VOD into the shape we store in Supabase. */
export function mapVodToRow(vod: TwitchVod, userId: string) {
  const duration_seconds = parseTwitchDuration(vod.duration);
  if (duration_seconds > MAX_PLAUSIBLE_VOD_SECONDS || duration_seconds < 0) {
    console.warn(
      `[twitch] Skipping VOD ${vod.id} with implausible duration ${duration_seconds}s ("${vod.duration}") — Twitch metadata bug.`
    );
    return null;
  }
  if (duration_seconds < MIN_ANALYZABLE_VOD_SECONDS) {
    console.warn(
      `[twitch] Skipping VOD ${vod.id} too short to analyze (${duration_seconds}s) — likely aborted stream stub.`
    );
    return null;
  }
  return {
    user_id: userId,
    twitch_vod_id: vod.id,
    title: vod.title,
    duration_seconds,
    thumbnail_url: buildThumbnail(vod.thumbnail_url),
    stream_date: vod.created_at,
    status: "pending" as const,
  };
}
