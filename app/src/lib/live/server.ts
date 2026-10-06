/**
 * Live: the server side of the private OBS dock.
 *
 * The dock asks GET /api/live/<token> about once a minute while it's open.
 * Each ask checks Twitch for the streamer's stream and, while they're live,
 * saves that minute's viewer count. When they go offline the session is
 * closed with the follower count, so the dock can show a summary.
 *
 * Nothing here runs in the background. A dock that isn't open costs nothing.
 *
 * Pro also gets the listening coach (listenOnce, below): while a dock is
 * open it hears the stream's audio, and every couple of minutes it may give
 * one tip made for this streamer.
 */

import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { getAppAccessToken, invalidateAppTokenCache } from "@/lib/twitch";
import { hasPaidPlan } from "@/lib/limits";
import { transcribeClip } from "@/lib/deepgram";
import { liveAudioPlaylistUrl, pullNewAudio } from "@/lib/live/listen";
import { coachTip, streamerHistory, type CoachContext } from "@/lib/live/coach";

/**
 * Free plans get the coaching for the first this-many minutes of each
 * stream; Pro gets all of it. The numbers (viewers, chat) show for everyone.
 */
export const FREE_COACH_MINUTES = 30;

/** Pro's listening coach hears up to this many hours of stream a month. */
export const PRO_COACH_HOURS = 30;
/** How often the coach looks at the stream and maybe says something. */
const COACH_EVERY_MS = Number(process.env.LIVE_COACH_EVERY_MS) || 150_000;
/** One dock listens at a time. Its claim runs out after this, in case it died mid-call. */
const LISTEN_LOCK_MS = 50_000;
/** A playlist link this old is swapped for a fresh one, even if it still works. */
const PLAYLIST_MAX_AGE_MS = 60 * 60_000;
/** The natural voices: at most this many characters a stream, about 90 cents' worth. */
const SPOKEN_CHARS_PER_STREAM = 30_000;

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
  /** When an OBS panel last checked in during this stream. */
  panelSeenAt: string | null;
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
export async function pollLive(owner: DockOwner, opts: { panel?: boolean } = {}): Promise<LiveState> {
  // An OBS panel checking in is noted every time, cached answer or not: a
  // phone in voice mode goes by it to decide whose nudges to speak.
  if (opts.panel) await markPanel(owner);

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
    panelSeenAt: (session.panel_seen_at as string | null) ?? null,
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
    panelSeenAt: (last.panel_seen_at as string | null) ?? null,
  };
}

async function sessionByStream(admin: Admin, userId: string, streamId: string) {
  const { data } = await admin
    .from("live_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("twitch_stream_id", streamId)
    .order("created_at", { ascending: true })
    .limit(1);
  return ((data ?? [])[0] ?? null) as Record<string, unknown> | null;
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

// ── Nudges passed from the OBS panel to a phone in voice mode ──────────

export interface RelayedCue {
  id: string;
  kind: string;
  title: string;
  action: string;
  say: string | null;
  tone: string;
  source: string;
  createdAt: string;
}

const CUE_KINDS = new Set(["raid", "newChatter", "quiet", "muted", "startingScene", "breakScene", "viewersDown", "viewersUp", "chatQuiet", "catchUp", "coach"]);
const CUE_TONES = new Set(["nudge", "good", "info"]);
/** At most this many nudges a minute per stream, whatever a panel sends. */
const MAX_CUES_PER_MINUTE = 20;
/** The same nudge twice in this long (two panels open) is saved once. */
const SAME_CUE_MS = 2 * 60_000;

async function openSession(admin: Admin, userId: string) {
  const { data } = await admin
    .from("live_sessions")
    .select("id, started_at, panel_seen_at")
    .eq("user_id", userId)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as { id: string; started_at: string; panel_seen_at: string | null } | null;
}

async function markPanel(owner: DockOwner): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("live_sessions")
    .update({ panel_seen_at: new Date().toISOString() })
    .eq("user_id", owner.userId)
    .is("ended_at", null);
}

/**
 * Save nudges the OBS panel showed, for a phone in voice mode to speak.
 * Held to the plan: a free stream's nudges stop at FREE_COACH_MINUTES,
 * the same as on screen, so a modified page gets no further.
 */
export async function saveCues(
  owner: DockOwner,
  cues: Array<{ kind?: unknown; title?: unknown; action?: unknown; say?: unknown; tone?: unknown }>
): Promise<number> {
  const admin = createAdminClient();
  const session = await openSession(admin, owner.userId);
  if (!session) return 0;
  if (!owner.pro && Date.now() - Date.parse(session.started_at) > FREE_COACH_MINUTES * 60_000) return 0;

  const minuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count } = await admin
    .from("live_cues")
    .select("id", { count: "exact", head: true })
    .eq("session_id", session.id)
    .gte("created_at", minuteAgo);
  const room = Math.max(0, MAX_CUES_PER_MINUTE - (count ?? 0));

  const { data: recent } = await admin
    .from("live_cues")
    .select("kind, title")
    .eq("session_id", session.id)
    .gte("created_at", new Date(Date.now() - SAME_CUE_MS).toISOString());
  const seen = new Set(((recent ?? []) as Array<{ kind: string; title: string }>).map((c) => `${c.kind}|${c.title}`));

  const clean = cues
    .filter((c) => typeof c.kind === "string" && CUE_KINDS.has(c.kind) && c.kind !== "coach" && typeof c.title === "string" && typeof c.action === "string")
    .filter((c) => !seen.has(`${c.kind}|${String(c.title).slice(0, 120)}`))
    .slice(0, Math.min(10, room))
    .map((c, i) => ({
      session_id: session.id,
      kind: String(c.kind),
      title: String(c.title).slice(0, 120),
      action: String(c.action).slice(0, 200),
      say: typeof c.say === "string" && c.say.trim() ? c.say.slice(0, 240) : null,
      tone: typeof c.tone === "string" && CUE_TONES.has(c.tone) ? c.tone : "nudge",
      source: "panel",
      // A millisecond apart, so a batch keeps its order for "newer than".
      created_at: new Date(Date.now() + i).toISOString(),
    }));
  if (!clean.length) return 0;
  const { error } = await admin.from("live_cues").insert(clean);
  if (error) throw new Error(error.message);
  return clean.length;
}

/** Nudges newer than `after` (an ISO time) in the stream that's live now. */
export async function cuesSince(owner: DockOwner, after: string | null): Promise<{ live: boolean; panelSeenAt: string | null; cues: RelayedCue[] }> {
  const admin = createAdminClient();
  const session = await openSession(admin, owner.userId);
  if (!session) return { live: false, panelSeenAt: null, cues: [] };
  // A phone that just opened gets the last minute, not the whole stream.
  const since = after && !Number.isNaN(Date.parse(after)) ? after : new Date(Date.now() - 60_000).toISOString();
  const { data } = await admin
    .from("live_cues")
    .select("id, kind, title, action, say, tone, source, created_at")
    .eq("session_id", session.id)
    .gt("created_at", since)
    .order("created_at", { ascending: true })
    .limit(20);
  const cues = ((data ?? []) as Array<Record<string, unknown>>).map(toRelayed);
  return { live: true, panelSeenAt: session.panel_seen_at, cues };
}

function toRelayed(r: Record<string, unknown>): RelayedCue {
  return {
    id: String(r.id),
    kind: String(r.kind),
    title: String(r.title),
    action: String(r.action),
    say: (r.say as string | null) ?? null,
    tone: String(r.tone),
    source: String(r.source),
    createdAt: String(r.created_at),
  };
}

/**
 * The coach's tips newer than `after`, so every open screen shows them,
 * not just the one that happened to be listening. No `after` (a screen
 * that just opened) gets the last minute and a half.
 */
async function coachCuesSince(admin: Admin, sessionId: string, after: unknown): Promise<RelayedCue[]> {
  const since = typeof after === "string" && !Number.isNaN(Date.parse(after)) ? after : new Date(Date.now() - 90_000).toISOString();
  const { data } = await admin
    .from("live_cues")
    .select("id, kind, title, action, say, tone, source, created_at")
    .eq("session_id", sessionId)
    .eq("source", "coach")
    .gt("created_at", since)
    .order("created_at", { ascending: true })
    .limit(5);
  return ((data ?? []) as Array<Record<string, unknown>>).map(toRelayed);
}

// ── The listening coach (Pro) ──────────────────────────────────────────

export type ListenState = "listening" | "busy" | "offline" | "pro" | "cap" | "noaudio";

export interface ListenResult {
  state: ListenState;
  /** When the dock should call again. */
  nextMs: number;
  /** The newest line heard, so the dock can show it's listening. */
  heard?: string | null;
  /** The coach's tips since the dock's `after`, oldest first. */
  cues?: RelayedCue[];
  usedHours?: number;
  capHours?: number;
}

export interface ListenInput {
  /** The newest tip this dock already has (its createdAt). */
  after?: unknown;
  chat?: unknown;
  scene?: unknown;
  quietSeconds?: unknown;
}

interface ChatLine {
  name: string;
  text: string;
  at: number;
  first: boolean;
}

/** The chat the dock sends: its last few minutes, trimmed to something sane. */
function chatFrom(input: unknown, now: number): ChatLine[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((m): m is Record<string, unknown> => !!m && typeof m === "object")
    .map((m) => ({
      name: String(m.name ?? "").slice(0, 40),
      text: String(m.text ?? "").slice(0, 200),
      at: Number(m.at),
      first: m.first === true,
    }))
    .filter((m) => m.name && m.text && Number.isFinite(m.at) && now - m.at < 5 * 60_000 && m.at <= now + 60_000)
    .slice(-60);
}

function monthStart(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

/** Seconds of stream the coach has heard for this streamer this month. */
async function listenedThisMonth(admin: Admin, userId: string): Promise<number> {
  const { data } = await admin.from("live_sessions").select("listened_seconds").eq("user_id", userId).gte("started_at", monthStart());
  return ((data ?? []) as Array<{ listened_seconds: number | null }>).reduce((a, r) => a + Number(r.listened_seconds ?? 0), 0);
}

/**
 * One call from an open dock: hear what the stream said since the last
 * call, and every COACH_EVERY_MS ask the coach whether there's a tip.
 * Only one dock at a time does this for a stream; the others get "busy".
 */
export async function listenOnce(owner: DockOwner, input: ListenInput): Promise<ListenResult> {
  if (!owner.pro) return { state: "pro", nextMs: 10 * 60_000 };
  const admin = createAdminClient();
  const { data: open } = await admin
    .from("live_sessions")
    .select("id, listen_lock_until")
    .eq("user_id", owner.userId)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!open) return { state: "offline", nextMs: 30_000 };

  const capHours = PRO_COACH_HOURS;
  const used = await listenedThisMonth(admin, owner.userId);
  const usedHours = Math.round((used / 3600) * 10) / 10;
  if (used >= capHours * 3600) return { state: "cap", nextMs: 10 * 60_000, usedHours, capHours };

  // Claim the stream for this call. Two docks open means one listens.
  const held = (open.listen_lock_until as string | null) ?? null;
  const busy = async (): Promise<ListenResult> => ({ state: "busy", nextMs: 15_000, usedHours, capHours, cues: await coachCuesSince(admin, open.id, input.after) });
  if (held && Date.parse(held) > Date.now()) return busy();
  const until = new Date(Date.now() + LISTEN_LOCK_MS).toISOString();
  const claim = admin.from("live_sessions").update({ listen_lock_until: until }).eq("id", open.id);
  // The row comes back from the claim itself: read any earlier and another
  // dock could finish in between, and this one would hear its audio again.
  const { data: claimed } = await (held ? claim.eq("listen_lock_until", held) : claim.is("listen_lock_until", null)).select(
    "id, started_at, title, game_name, listen_url, listen_url_at, listen_seq, coached_at, listened_seconds, coach_calls, coach_tokens_in, coach_tokens_out"
  );
  const session = (claimed ?? [])[0] as Record<string, unknown> | undefined;
  const sessionId = String(open.id);
  if (!session) return busy();

  try {
    const now = Date.now();
    const patch: Record<string, unknown> = {};

    // ── Hear ──
    // A new playlist link numbers its segments from 0 again, and starts
    // from now, so it's read from its start rather than after the old number.
    let url = (session.listen_url as string | null) ?? null;
    let afterSeq = session.listen_seq === null || session.listen_seq === undefined ? null : Number(session.listen_seq);
    const urlAt = session.listen_url_at ? Date.parse(String(session.listen_url_at)) : 0;
    if (!url || now - urlAt > PLAYLIST_MAX_AGE_MS) {
      url = await liveAudioPlaylistUrl(owner.login);
      patch.listen_url = url;
      patch.listen_url_at = new Date().toISOString();
      afterSeq = null;
    }
    if (!url) return { state: "noaudio", nextMs: 60_000, usedHours, capHours };
    let pulled = await pullNewAudio(url, afterSeq);
    if (pulled.gone) {
      url = await liveAudioPlaylistUrl(owner.login);
      patch.listen_url = url;
      patch.listen_url_at = new Date().toISOString();
      if (!url) {
        await admin.from("live_sessions").update(patch).eq("id", sessionId);
        return { state: "noaudio", nextMs: 60_000, usedHours, capHours };
      }
      pulled = await pullNewAudio(url, null);
    }

    let heard: string | null = null;
    if (pulled.audio) {
      try {
        const { segments } = await transcribeClip(pulled.audio);
        // Twitch's own clock for the audio, else "just now, minus the clip".
        const start = pulled.startAt ?? now - pulled.seconds * 1000;
        const lines = segments
          .map((u) => ({ session_id: sessionId, said_at: new Date(start + u.start * 1000).toISOString(), text: u.text.trim().slice(0, 500) }))
          .filter((l) => l.text);
        if (lines.length) {
          await admin.from("live_lines").insert(lines);
          heard = lines[lines.length - 1].text;
        }
      } catch (err) {
        // That stretch goes unheard rather than tried again: a clip that
        // can't be read once won't be read on the next call either.
        console.error("[live] transcribing failed:", err instanceof Error ? err.message : err);
      }
    }
    // Saved before the coach runs, so nothing gets heard (and paid for) twice.
    patch.listen_seq = pulled.lastSeq;
    patch.listened_seconds = Number(session.listened_seconds ?? 0) + Math.round(pulled.seconds);
    await admin.from("live_sessions").update(patch).eq("id", sessionId);

    // ── Coach ──
    const coached: Record<string, unknown> = {};
    const coachedAt = session.coached_at ? Date.parse(String(session.coached_at)) : null;
    if (coachedAt === null) {
      // The first call starts the clock, so the first tip has a few minutes to go on.
      coached.coached_at = new Date().toISOString();
    } else if (now - coachedAt >= COACH_EVERY_MS) {
      // Set first: a failed look waits its turn like any other, no retry storm.
      coached.coached_at = new Date().toISOString();
      try {
        const context = await coachContext(admin, owner, session, input, now);
        if (context.heard.length || context.chat.length) {
          const answer = await coachTip(context);
          coached.coach_calls = Number(session.coach_calls ?? 0) + 1;
          coached.coach_tokens_in = Number(session.coach_tokens_in ?? 0) + answer.tokensIn;
          coached.coach_tokens_out = Number(session.coach_tokens_out ?? 0) + answer.tokensOut;
          if (answer.tip) {
            const { error } = await admin
              .from("live_cues")
              .insert({ session_id: sessionId, kind: "coach", title: answer.tip.title, action: answer.tip.say, say: answer.tip.say, tone: answer.tip.tone, source: "coach" });
            if (error) throw new Error(error.message);
          }
        }
      } catch (err) {
        console.error("[live] coach failed:", err instanceof Error ? err.message : err);
      }
    }
    if (Object.keys(coached).length) await admin.from("live_sessions").update(coached).eq("id", sessionId);
    // Call again before the playlist rolls past what this call saw.
    const nextMs = pulled.windowSeconds ? Math.min(30_000, Math.max(8_000, (pulled.windowSeconds - 8) * 1000)) : 15_000;
    return { state: "listening", nextMs, heard, cues: await coachCuesSince(admin, sessionId, input.after), usedHours, capHours };
  } finally {
    await admin.from("live_sessions").update({ listen_lock_until: null }).eq("id", sessionId).eq("listen_lock_until", until);
  }
}

/** Everything the coach gets to see for one look at the stream. */
async function coachContext(admin: Admin, owner: DockOwner, session: Record<string, unknown>, input: ListenInput, now: number): Promise<CoachContext> {
  const since = (ms: number) => new Date(now - ms).toISOString();
  const [{ data: lines }, { data: tips }, { data: shown }, { data: samples }, history] = await Promise.all([
    admin.from("live_lines").select("said_at, text").eq("session_id", session.id).gte("said_at", since(4 * 60_000)).order("said_at", { ascending: true }).limit(80),
    admin.from("live_cues").select("title, say, created_at").eq("session_id", session.id).eq("source", "coach").gte("created_at", since(20 * 60_000)).order("created_at", { ascending: true }).limit(10),
    admin.from("live_cues").select("title, action, created_at").eq("session_id", session.id).neq("source", "coach").gte("created_at", since(10 * 60_000)).order("created_at", { ascending: true }).limit(10),
    admin.from("live_samples").select("minute, viewers").eq("session_id", session.id).order("minute", { ascending: false }).limit(15),
    streamerHistory(admin, owner.userId).catch(() => null),
  ]);
  const quiet = Number(input.quietSeconds);
  return {
    name: owner.displayName,
    game: (session.game_name as string | null) || null,
    title: (session.title as string | null) || null,
    minutesLive: Math.max(0, Math.round((now - Date.parse(String(session.started_at))) / 60_000)),
    viewers: ((samples ?? []) as Array<{ viewers: number }>).map((r) => Number(r.viewers)).reverse(),
    scene: typeof input.scene === "string" && input.scene ? input.scene.slice(0, 80) : null,
    quietSeconds: Number.isFinite(quiet) && quiet >= 0 ? quiet : null,
    heard: ((lines ?? []) as Array<{ said_at: string; text: string }>).map((l) => ({ agoSec: (now - Date.parse(l.said_at)) / 1000, text: l.text })),
    chat: chatFrom(input.chat, now).map((m) => ({ agoSec: (now - m.at) / 1000, name: m.name, text: m.text, first: m.first })),
    recentTips: ((tips ?? []) as Array<{ title: string; say: string | null; created_at: string }>).map((t) => ({ agoSec: (now - Date.parse(t.created_at)) / 1000, text: t.say || t.title })),
    shown: ((shown ?? []) as Array<{ title: string; action: string; created_at: string }>).map((t) => ({ agoSec: (now - Date.parse(t.created_at)) / 1000, text: `${t.title}. ${t.action}` })),
    history,
  };
}

/**
 * May this stream have another line read in a natural voice? Pro only,
 * while live, within the stream's budget. Counts the characters if so.
 */
export async function spendSpokenChars(owner: DockOwner, chars: number): Promise<boolean> {
  if (!owner.pro) return false;
  const admin = createAdminClient();
  const { data: session } = await admin
    .from("live_sessions")
    .select("id, tts_chars")
    .eq("user_id", owner.userId)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!session) return false;
  const spent = Number(session.tts_chars ?? 0);
  if (spent + chars > SPOKEN_CHARS_PER_STREAM) return false;
  await admin.from("live_sessions").update({ tts_chars: spent + chars }).eq("id", session.id);
  return true;
}
