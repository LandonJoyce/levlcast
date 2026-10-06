/**
 * Live: the server side of the private OBS dock.
 *
 * The dock asks GET /api/live/<token> about once a minute while it's open.
 * Each ask checks Twitch for the streamer's stream and, while they're live,
 * saves that minute's viewer count. When they go offline the session is
 * closed with the follower count, so the dock can show a summary.
 *
 * Nothing here runs in the background. A dock that isn't open costs nothing.
 */

import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { getAppAccessToken, invalidateAppTokenCache } from "@/lib/twitch";
import { hasPaidPlan } from "@/lib/limits";

/**
 * Free plans get the coaching for the first this-many minutes of each
 * stream; Pro gets all of it. The numbers (viewers, chat) show for everyone.
 */
export const FREE_COACH_MINUTES = 30;

/** Twitch's API, overridable so the dock can be tested against a stand-in. */
const HELIX = process.env.TWITCH_API_BASE || "https://api.twitch.tv";

/** A dock asking more often than this gets the last answer back, unsaved. */
const MIN_POLL_MS = 20_000;
/** How often the follower count is re-read during a stream. */
const FOLLOWER_EVERY_MS = 5 * 60_000;

const TOKEN_RE = /^[A-Za-z0-9_-]{24,64}$/;

export interface DockOwner {
  userId: string;
  twitchId: string;
  login: string;
  displayName: string;
  pro: boolean;
}

export interface LiveSession {
  id: string;
  startedAt: string;
  endedAt: string | null;
  title: string | null;
  gameName: string | null;
  viewers: number | null;
  peak: number;
  avg: number | null;
  /** [minute since start, viewers], oldest first. Gaps are minutes the dock wasn't open. */
  samples: Array<[number, number]>;
  followersStart: number | null;
  followersNow: number | null;
}

export interface LiveState {
  live: boolean;
  channel: { login: string; displayName: string };
  /** Pro is coached all stream; free for the first freeCoachMinutes. */
  pro: boolean;
  freeCoachMinutes: number;
  /** The live session, or the last one when offline. */
  session: LiveSession | null;
  serverTime: string;
}

type Admin = ReturnType<typeof createAdminClient>;

// ── Dock links ──────────────────────────────────────────────────────────

export function isDockToken(token: string): boolean {
  return TOKEN_RE.test(token);
}

function newToken(): string {
  return randomBytes(24).toString("base64url");
}

/** The streamer's dock token, made the first time it's asked for. */
export async function dockTokenFor(userId: string): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin.from("live_docks").select("token").eq("user_id", userId).maybeSingle();
  if (data?.token) return String(data.token);
  const token = newToken();
  const { error } = await admin.from("live_docks").insert({ user_id: userId, token });
  if (error) {
    // Two tabs asking at once: the other one's insert won.
    const { data: again } = await admin.from("live_docks").select("token").eq("user_id", userId).maybeSingle();
    if (again?.token) return String(again.token);
    throw new Error(`Couldn't make a dock link: ${error.message}`);
  }
  return token;
}

/** A new token, which retires the old link everywhere it was pasted. */
export async function rotateDockToken(userId: string): Promise<string> {
  const admin = createAdminClient();
  const token = newToken();
  const { data: existing } = await admin.from("live_docks").select("user_id").eq("user_id", userId).maybeSingle();
  const { error } = existing
    ? await admin.from("live_docks").update({ token, created_at: new Date().toISOString() }).eq("user_id", userId)
    : await admin.from("live_docks").insert({ user_id: userId, token });
  if (error) throw new Error(`Couldn't make a new dock link: ${error.message}`);
  pollCache.clear();
  return token;
}

export async function ownerOfDock(token: string): Promise<DockOwner | null> {
  if (!isDockToken(token)) return null;
  const admin = createAdminClient();
  const { data: dock } = await admin.from("live_docks").select("user_id").eq("token", token).maybeSingle();
  if (!dock?.user_id) return null;
  const { data: profile } = await admin
    .from("profiles")
    .select("id, twitch_id, twitch_login, twitch_display_name, plan, subscription_expires_at")
    .eq("id", dock.user_id)
    .maybeSingle();
  if (!profile?.twitch_id || !profile.twitch_login) return null;
  return {
    userId: String(profile.id),
    twitchId: String(profile.twitch_id),
    login: String(profile.twitch_login),
    displayName: String(profile.twitch_display_name || profile.twitch_login),
    pro: hasPaidPlan(profile as { plan?: string | null; subscription_expires_at?: string | null }),
  };
}

// ── Twitch ──────────────────────────────────────────────────────────────

/** The stand-in API used in local tests takes any token, so skip Twitch's login there. */
async function appToken(): Promise<string> {
  return process.env.TWITCH_API_BASE ? "local-test-token" : getAppAccessToken();
}

async function helix(path: string): Promise<Response> {
  const call = async () =>
    fetch(`${HELIX}/helix/${path}`, {
      headers: { Authorization: `Bearer ${await appToken()}`, "Client-Id": process.env.TWITCH_CLIENT_ID ?? "" },
      cache: "no-store",
    });
  let res = await call();
  if (res.status === 401) {
    // A rotated client secret invalidates every cached app token.
    invalidateAppTokenCache();
    res = await call();
  }
  return res;
}

interface TwitchStream {
  id: string;
  startedAt: string;
  title: string;
  gameName: string;
  viewers: number;
}

/** The channel's live stream right now, or null when it's offline. */
export async function liveStreamFor(twitchId: string): Promise<TwitchStream | null> {
  const res = await helix(`streams?user_id=${encodeURIComponent(twitchId)}`);
  if (!res.ok) throw new Error(`Twitch said ${res.status} checking the stream`);
  const row = ((await res.json()) as { data?: Array<Record<string, unknown>> }).data?.[0];
  if (!row || row.type !== "live") return null;
  return {
    id: String(row.id),
    startedAt: String(row.started_at),
    title: String(row.title ?? ""),
    gameName: String(row.game_name ?? ""),
    viewers: Number(row.viewer_count ?? 0),
  };
}

/** The channel's follower total. Twitch gives the total to any app, no scope needed. */
export async function followerTotal(twitchId: string): Promise<number | null> {
  try {
    const res = await helix(`channels/followers?broadcaster_id=${encodeURIComponent(twitchId)}`);
    if (!res.ok) return null;
    const total = ((await res.json()) as { total?: number }).total;
    return typeof total === "number" ? total : null;
  } catch {
    return null;
  }
}

// ── One poll from the dock ──────────────────────────────────────────────

const pollCache = new Map<string, { at: number; state: LiveState }>();
const followerCache = new Map<string, { at: number; total: number | null }>();

/**
 * Answer one poll: check Twitch, save this minute while live, close the
 * session once the stream is over. Polls closer together than MIN_POLL_MS
 * (two docks, or a quick reload) get the last answer and save nothing.
 */
export async function pollLive(owner: DockOwner): Promise<LiveState> {
  const cached = pollCache.get(owner.userId);
  if (cached && Date.now() - cached.at < MIN_POLL_MS) return cached.state;

  const admin = createAdminClient();
  const stream = await liveStreamFor(owner.twitchId);
  const base = {
    channel: { login: owner.login, displayName: owner.displayName },
    pro: owner.pro,
    freeCoachMinutes: FREE_COACH_MINUTES,
    serverTime: new Date().toISOString(),
  };
  const state: LiveState = stream
    ? { ...base, live: true, session: await recordMinute(admin, owner, stream) }
    : { ...base, live: false, session: await closeAndSummarize(admin, owner) };

  pollCache.set(owner.userId, { at: Date.now(), state });
  return state;
}

async function recordMinute(admin: Admin, owner: DockOwner, stream: TwitchStream): Promise<LiveSession> {
  const now = new Date();

  // A different stream still open means the last one ended without the
  // dock seeing it go offline (a restart, or the dock was closed).
  const { data: open } = await admin
    .from("live_sessions")
    .select("id, twitch_stream_id, last_seen_at")
    .eq("user_id", owner.userId)
    .is("ended_at", null);
  for (const s of (open ?? []) as Array<{ id: string; twitch_stream_id: string; last_seen_at: string }>) {
    if (s.twitch_stream_id !== stream.id) {
      await admin
        .from("live_sessions")
        .update({ ended_at: s.last_seen_at, followers_end: await followerTotal(owner.twitchId) })
        .eq("id", s.id);
    }
  }

  let session = await sessionByStream(admin, owner.userId, stream.id);
  if (!session) {
    const { error } = await admin.from("live_sessions").insert({
      user_id: owner.userId,
      twitch_stream_id: stream.id,
      started_at: stream.startedAt,
      title: stream.title,
      game_name: stream.gameName,
      followers_start: await followerTotal(owner.twitchId),
      last_seen_at: now.toISOString(),
    });
    // A duplicate means another poll made it a moment ago; read that one.
    if (error && !/duplicate|23505/i.test(`${error.code} ${error.message}`)) throw new Error(error.message);
    session = await sessionByStream(admin, owner.userId, stream.id);
    if (!session) throw new Error("The live session wasn't saved");
  }

  const minute = Math.max(0, Math.floor((now.getTime() - Date.parse(stream.startedAt)) / 60_000));
  const { data: have } = await admin
    .from("live_samples")
    .select("minute")
    .eq("session_id", session.id)
    .eq("minute", minute)
    .maybeSingle();
  if (!have) {
    await admin.from("live_samples").insert({ session_id: session.id, minute, viewers: stream.viewers });
  }

  const samples = await samplesFor(admin, String(session.id));
  const peak = samples.reduce((m, [, v]) => Math.max(m, v), 0);
  const sum = samples.reduce((a, [, v]) => a + v, 0);

  // Re-read followers every few minutes, not every poll.
  const key = String(session.id);
  let followersNow = followerCache.get(key);
  if (!followersNow || Date.now() - followersNow.at > FOLLOWER_EVERY_MS) {
    followersNow = { at: Date.now(), total: await followerTotal(owner.twitchId) };
    followerCache.set(key, followersNow);
  }

  await admin
    .from("live_sessions")
    .update({
      title: stream.title,
      game_name: stream.gameName,
      peak_viewers: peak,
      viewer_sum: sum,
      sample_count: samples.length,
      last_seen_at: now.toISOString(),
      // Live again after Twitch briefly said offline (a dropped connection,
      // same stream id): it never really ended.
      ended_at: null,
      followers_end: null,
    })
    .eq("id", session.id);

  return {
    id: String(session.id),
    startedAt: stream.startedAt,
    endedAt: null,
    title: stream.title,
    gameName: stream.gameName,
    viewers: stream.viewers,
    peak,
    avg: samples.length ? sum / samples.length : null,
    samples,
    followersStart: (session.followers_start as number | null) ?? null,
    followersNow: followersNow.total,
  };
}

/** Offline: close any session still open, then return the most recent one. */
async function closeAndSummarize(admin: Admin, owner: DockOwner): Promise<LiveSession | null> {
  const { data: open } = await admin
    .from("live_sessions")
    .select("id, last_seen_at")
    .eq("user_id", owner.userId)
    .is("ended_at", null);
  for (const s of (open ?? []) as Array<{ id: string; last_seen_at: string }>) {
    await admin
      .from("live_sessions")
      .update({ ended_at: s.last_seen_at, followers_end: await followerTotal(owner.twitchId) })
      .eq("id", s.id);
    followerCache.delete(String(s.id));
  }

  const { data: last } = await admin
    .from("live_sessions")
    .select("*")
    .eq("user_id", owner.userId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!last) return null;
  const samples = await samplesFor(admin, String(last.id));
  const count = Number(last.sample_count ?? samples.length);
  return {
    id: String(last.id),
    startedAt: String(last.started_at),
    endedAt: (last.ended_at as string | null) ?? null,
    title: (last.title as string | null) ?? null,
    gameName: (last.game_name as string | null) ?? null,
    viewers: null,
    peak: Number(last.peak_viewers ?? 0),
    avg: count ? Number(last.viewer_sum ?? 0) / count : null,
    samples,
    followersStart: (last.followers_start as number | null) ?? null,
    followersNow: (last.followers_end as number | null) ?? null,
  };
}

async function sessionByStream(admin: Admin, userId: string, streamId: string) {
  const { data } = await admin
    .from("live_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("twitch_stream_id", streamId)
    .maybeSingle();
  return data as Record<string, unknown> | null;
}

async function samplesFor(admin: Admin, sessionId: string): Promise<Array<[number, number]>> {
  const { data } = await admin
    .from("live_samples")
    .select("minute, viewers")
    .eq("session_id", sessionId)
    .order("minute", { ascending: true })
    .limit(2000);
  return ((data ?? []) as Array<{ minute: number; viewers: number }>).map((r) => [Number(r.minute), Number(r.viewers)]);
}
