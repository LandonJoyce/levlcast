const HELIX_BASE = "https://api.twitch.tv/helix";

let cachedAppToken: { token: string; expiresAt: number } | null = null;

/**
 * Get a Twitch App Access Token using client credentials.
 * This doesn't require user auth — works for public data like VODs.
 * Cached in memory until expiry.
 */
export async function getAppAccessToken(): Promise<string> {
  if (cachedAppToken && Date.now() < cachedAppToken.expiresAt) {
    return cachedAppToken.token;
  }

  console.log("[debug] client_id:", process.env.TWITCH_CLIENT_ID?.slice(0, 6), "secret:", process.env.TWITCH_CLIENT_SECRET?.slice(0, 6));
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
    throw new Error(`Failed to get Twitch app token: ${res.status}`);
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
  duration: string; // e.g. "3h14m22s"
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
 * Handles pagination to fetch up to `limit` VODs.
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

/**
 * Get the actual playable video URL for a Twitch VOD.
 * Uses Twitch's GQL API to get a playback access token,
 * then constructs the usher URL for the video stream.
 */
export async function downloadTwitchVodAudio(
  vodId: string
): Promise<Buffer> {
  // Twitch's public web client ID (used by the website itself)
  const GQL_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";

  // Step 1: Get playback access token via GQL
  const gqlRes = await fetch("https://gql.twitch.tv/gql", {
    method: "POST",
    headers: {
      "Client-Id": GQL_CLIENT_ID,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      operationName: "PlaybackAccessToken",
      query: `query PlaybackAccessToken($vodID: ID!, $playerType: String!) {
        videoPlaybackAccessToken(id: $vodID, params: {platform: "web", playerBackend: "mediaplayer", playerType: $playerType}) {
          value
          signature
        }
      }`,
      variables: {
        vodID: vodId,
        playerType: "site",
      },
    }),
  });

  if (!gqlRes.ok) {
    throw new Error(`Twitch GQL failed: ${gqlRes.status}`);
  }

  const gqlData = await gqlRes.json();
  console.log("[twitch] GQL response:", JSON.stringify(gqlData));
  const token = gqlData.data?.videoPlaybackAccessToken;

  if (!token) {
    throw new Error(
      "Could not get video playback token. GQL response: " +
        JSON.stringify(gqlData)
    );
  }

  // Step 2: Get the m3u8 master playlist URL
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

  // Step 3: Fetch the master playlist and find the audio-only or lowest quality stream
  const masterRes = await fetch(masterUrl);
  if (!masterRes.ok) {
    throw new Error(`Usher failed: ${masterRes.status}`);
  }

  const masterPlaylist = await masterRes.text();
  const lines = masterPlaylist.split("\n");

  // Look for audio_only first, then fall back to any stream URL
  let streamUrl = "";
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("audio_only") || lines[i].includes("VIDEO=\"audio_only\"")) {
      // Next non-comment line is the URL
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim() && !lines[j].startsWith("#")) {
          streamUrl = lines[j].trim();
          break;
        }
      }
      break;
    }
  }

  // Fallback: grab the last URL in the playlist (usually lowest quality)
  if (!streamUrl) {
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line && !line.startsWith("#") && line.startsWith("http")) {
        streamUrl = line;
        break;
      }
    }
  }

  if (!streamUrl) {
    throw new Error("No stream URL found in master playlist");
  }

  // Step 4: Fetch the sub-playlist to get individual .ts segment URLs
  const subRes = await fetch(streamUrl);
  if (!subRes.ok) {
    throw new Error(`Sub-playlist fetch failed: ${subRes.status}`);
  }

  const subPlaylist = await subRes.text();

  // Resolve relative segment URLs against the playlist base URL
  const baseUrl = streamUrl.substring(0, streamUrl.lastIndexOf("/") + 1);
  const segmentUrls = subPlaylist
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#"))
    .map((l) => {
      const trimmed = l.trim();
      return trimmed.startsWith("http") ? trimmed : baseUrl + trimmed;
    });

  if (segmentUrls.length === 0) {
    throw new Error("No segments found in playlist");
  }

  console.log(`[twitch] Found ${segmentUrls.length} segments to download`);

  // Step 5: Download all segments and concatenate into one buffer
  const chunks: Buffer[] = [];
  for (const url of segmentUrls) {
    const segRes = await fetch(url);
    if (!segRes.ok) continue;
    const buf = Buffer.from(await segRes.arrayBuffer());
    chunks.push(buf);
  }

  return Buffer.concat(chunks);
}

/** Convert a raw Twitch VOD into the shape we store in Supabase */
export function mapVodToRow(
  vod: TwitchVod,
  userId: string
) {
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
