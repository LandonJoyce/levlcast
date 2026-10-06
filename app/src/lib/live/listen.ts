/**
 * The listening coach's ears: the stream's own audio, the way a viewer
 * hears it.
 *
 * Twitch serves a live stream as HLS: a short playlist of two-second audio
 * segments that rolls forward as the stream goes. Each call picks up the
 * segments that came out since the last one, leaves out Twitch's ads, and
 * hands back the audio for Deepgram. The open dock drives the calls (POST
 * /api/live/<token>/listen, about every half minute), so nothing runs when
 * no dock is open.
 *
 * Getting the playlist works like the VOD audio in lib/twitch.ts: the web
 * player's anonymous access token, then Twitch's usher for the playlist.
 */

/** Overridable so the coach can be tested against a stand-in Twitch. */
const GQL_URL = process.env.TWITCH_GQL_URL || "https://gql.twitch.tv/gql";
const USHER_URL = process.env.TWITCH_USHER_URL || "https://usher.ttvnw.net";
const GQL_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";

/** At most this many segments (about 90 seconds) per call, however long it's been. */
const MAX_SEGMENTS = 45;

export interface Segment {
  seq: number;
  url: string;
  seconds: number;
  /** One of Twitch's ads, not the stream. */
  ad: boolean;
  /** When it went out (ms), from the playlist's program date time. */
  at: number | null;
}

export interface Pulled {
  /** The new audio, ready for Deepgram; null when there was none. */
  audio: Buffer | null;
  /** Seconds of stream audio in it. */
  seconds: number;
  /** When the first of it went out (ms), if the playlist said. */
  startAt: number | null;
  /** The newest segment seen, ads included: the next call starts after it. */
  lastSeq: number | null;
  /** How much the playlist holds, which sets how often to call. */
  windowSeconds: number;
  /** The playlist link stopped working, so a new one is needed. */
  gone: boolean;
}

/** The audio-only playlist of a channel that's live, or null when it isn't. */
export async function liveAudioPlaylistUrl(login: string): Promise<string | null> {
  const gql = await fetch(GQL_URL, {
    method: "POST",
    headers: { "Client-Id": GQL_CLIENT_ID, "Content-Type": "application/json" },
    body: JSON.stringify({
      operationName: "PlaybackAccessToken",
      query: `query PlaybackAccessToken($login: String!, $playerType: String!) {
        streamPlaybackAccessToken(channelName: $login, params: {platform: "web", playerBackend: "mediaplayer", playerType: $playerType}) {
          value
          signature
        }
      }`,
      variables: { login: login.toLowerCase(), playerType: "site" },
    }),
    cache: "no-store",
  });
  if (!gql.ok) throw new Error(`Twitch GQL said ${gql.status}`);
  const json = (await gql.json()) as { data?: { streamPlaybackAccessToken?: { value: string; signature: string } | null } };
  const token = json.data?.streamPlaybackAccessToken;
  if (!token) return null;

  const params = new URLSearchParams({
    allow_source: "true",
    allow_audio_only: "true",
    player: "twitchweb",
    playlist_include_framerate: "true",
    p: String(Math.floor(Math.random() * 1e7)),
    sig: token.signature,
    token: token.value,
  });
  const master = await fetch(`${USHER_URL}/api/channel/hls/${encodeURIComponent(login.toLowerCase())}.m3u8?${params}`, { cache: "no-store" });
  if (master.status === 404) return null; // offline
  if (!master.ok) throw new Error(`Twitch usher said ${master.status}`);
  return pickAudioRendition(await master.text(), master.url);
}

/** The audio-only rendition in a master playlist, else the smallest one (it has the audio too). */
export function pickAudioRendition(text: string, baseUrl: string): string | null {
  const lines = text.split(/\r?\n/);
  let smallest: { bandwidth: number; url: string } | null = null;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith("#EXT-X-STREAM-INF")) continue;
    const next = lines.slice(i + 1).find((l) => l.trim() && !l.startsWith("#"));
    if (!next) continue;
    const url = new URL(next.trim(), baseUrl).toString();
    if (/VIDEO="audio_only"/.test(lines[i])) return url;
    const bandwidth = Number(lines[i].match(/BANDWIDTH=(\d+)/)?.[1] ?? Infinity);
    if (!smallest || bandwidth < smallest.bandwidth) smallest = { bandwidth, url };
  }
  return smallest?.url ?? null;
}

/**
 * The segments in a live media playlist. Twitch marks its ads two ways, an
 * EXTINF title other than "live" and a "twitch-stitched-ad" date range
 * covering the segment's time, and either one counts. Prefetch hints
 * (#EXT-X-TWITCH-PREFETCH) aren't segments yet, so they're left for later.
 */
export function parsePlaylist(text: string, baseUrl: string): { segments: Segment[]; init: string | null } {
  let seq = 0;
  let init: string | null = null;
  let nextAt: number | null = null;
  let pending: { seconds: number; title: string; at: number | null } | null = null;
  const ads: Array<{ start: number; end: number }> = [];
  const segments: Segment[] = [];

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#EXT-X-MEDIA-SEQUENCE:")) {
      seq = Number(line.slice(22)) || 0;
    } else if (line.startsWith("#EXT-X-MAP:")) {
      const uri = line.match(/URI="([^"]+)"/)?.[1];
      if (uri) init = new URL(uri, baseUrl).toString();
    } else if (line.startsWith("#EXT-X-PROGRAM-DATE-TIME:")) {
      const t = Date.parse(line.slice(25));
      nextAt = Number.isNaN(t) ? null : t;
    } else if (line.startsWith("#EXT-X-DATERANGE:")) {
      if (/CLASS="twitch-stitched-ad"/.test(line) || /ID="stitched-ad-/.test(line)) {
        const start = Date.parse(line.match(/START-DATE="([^"]+)"/)?.[1] ?? "");
        const seconds = Number(line.match(/DURATION=([\d.]+)/)?.[1]);
        if (!Number.isNaN(start) && Number.isFinite(seconds)) ads.push({ start, end: start + seconds * 1000 });
      }
    } else if (line.startsWith("#EXTINF:")) {
      const [length, ...title] = line.slice(8).split(",");
      pending = { seconds: Number(length) || 0, title: title.join(",").trim(), at: nextAt };
      nextAt = null;
    } else if (!line.startsWith("#") && pending) {
      const prev = segments[segments.length - 1];
      const at = pending.at ?? (prev?.at != null ? prev.at + prev.seconds * 1000 : null);
      const inAd = at !== null && ads.some((a) => at >= a.start && at < a.end);
      segments.push({
        seq,
        url: new URL(line, baseUrl).toString(),
        seconds: pending.seconds,
        ad: inAd || (pending.title !== "" && pending.title !== "live"),
        at,
      });
      seq++;
      pending = null;
    }
  }
  return { segments, init };
}

async function fetchBytes(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
    return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

/**
 * The stream audio that came out after segment `afterSeq` (all of the
 * playlist the first time). A segment that fails to download is left out:
 * a gap of two seconds doesn't matter to the coach.
 */
export async function pullNewAudio(playlistUrl: string, afterSeq: number | null): Promise<Pulled> {
  const none = { audio: null, seconds: 0, startAt: null };
  const res = await fetch(playlistUrl, { signal: AbortSignal.timeout(10_000), cache: "no-store" }).catch(() => null);
  if (!res?.ok) return { ...none, lastSeq: afterSeq, windowSeconds: 0, gone: true };

  const { segments, init } = parsePlaylist(await res.text(), playlistUrl);
  const windowSeconds = segments.reduce((a, s) => a + s.seconds, 0);
  const newest = segments[segments.length - 1]?.seq ?? null;
  // Numbering that went backwards means the stream's playlist restarted.
  const after = afterSeq !== null && newest !== null && newest < afterSeq ? null : afterSeq;
  const wanted = segments.filter((s) => (after === null || s.seq > after) && !s.ad).slice(-MAX_SEGMENTS);
  const lastSeq = newest ?? afterSeq;
  if (!wanted.length) return { ...none, lastSeq, windowSeconds, gone: false };

  const [head, ...parts] = await Promise.all([init ? fetchBytes(init) : Promise.resolve(null), ...wanted.map((s) => fetchBytes(s.url))]);
  const kept = wanted.filter((_, i) => parts[i]);
  if (!kept.length || (init && !head)) return { ...none, lastSeq, windowSeconds, gone: false };
  return {
    // fMP4 needs its init segment in front; MPEG-TS stands on its own.
    audio: Buffer.concat([...(head ? [head] : []), ...parts.filter((p): p is Buffer => p !== null)]),
    seconds: kept.reduce((a, s) => a + s.seconds, 0),
    startAt: kept[0].at,
    lastSeq,
    windowSeconds,
    gone: false,
  };
}
