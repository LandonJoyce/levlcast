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
export async function getTwitchVodAudioUrl(vodId: string): Promise<string> {
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

  if (!gqlRes.ok) throw new Error(`Twitch GQL failed: ${gqlRes.status}`);

  const gqlData = await gqlRes.json();
  const token = gqlData.data?.videoPlaybackAccessToken;
  if (!token) throw new Error("Could not get video playback token");

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

  if (!gqlRes.ok) throw new Error(`Twitch GQL failed: ${gqlRes.status}`);
  const gqlData = await gqlRes.json();
  const token = gqlData.data?.videoPlaybackAccessToken;
  if (!token) throw new Error("Could not get video playback token from Twitch GQL");

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
 * Stream Twitch VOD audio segments directly into a PassThrough — no disk writes.
 * The returned PassThrough is written to in the background; pass it straight to
 * transcribePassThrough() so Deepgram receives data as it downloads.
 */
export function streamTwitchVodAudio(vodId: string): PassThrough {
  const passThrough = new PassThrough();

  (async () => {
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

    if (!gqlRes.ok) throw new Error(`Twitch GQL failed: ${gqlRes.status}`);
    const gqlData = await gqlRes.json();
    const token = gqlData.data?.videoPlaybackAccessToken;
    if (!token) throw new Error("Could not get video playback token");

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

    for (const url of segmentUrls) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const segRes = await fetch(url, { signal: controller.signal });
        if (!segRes.ok) continue;
        const buf = Buffer.from(await segRes.arrayBuffer());
        passThrough.write(buf);
      } catch (err: any) {
        if (err.name === "AbortError") {
          console.warn(`[twitch] Segment timeout, skipping: ${url}`);
          continue;
        }
        throw err;
      } finally {
        clearTimeout(timeout);
      }
    }

    passThrough.end();
  })().catch((err) => passThrough.destroy(err));

  return passThrough;
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
