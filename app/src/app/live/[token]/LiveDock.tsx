"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Settings, X } from "lucide-react";
import { CueEngine, SHOW_FOR, clock, nowCue, spokenLine, type Cue, type CueKind, type LiveFix, type LiveSignals } from "@/lib/live/cues";
import { ObsLink, type ObsInput, type ObsProblem, type ObsStatus } from "@/lib/live/obs";
import { TwitchChat, clipIdIn } from "@/lib/live/chat";
import { AudioBalance } from "@/lib/live/balance";
import { isQuestion } from "@/lib/live/chat-digest";
import { Voice, deviceVoices, loadVoicePick, saveVoicePick, voiceName, voiceNote, type VoicePick } from "@/lib/live/voice";
import { LEVL_VOICES, SAMPLE_LINES } from "@/lib/live/voices";
import { DIVISION_SIZE, TIER_HEX, rankFromPoints } from "@/lib/rank";
import { nextDivision } from "@/components/dashboard/rank-panel";
import DeadLink from "./DeadLink";

/**
 * The Live dock: what a streamer keeps open inside OBS while they stream.
 *
 * Three sources, all read live:
 *  - the server, about once a minute: Twitch's viewer count (also saved,
 *    for the summary afterwards), followers, when the stream started
 *  - Twitch chat, read anonymously: chatters, first-time chatters, raids
 *  - OBS on this computer, if connected: the mic level and the scene
 *
 * From those, lib/live/cues.ts decides what to tell them, one cue at a time.
 * On Pro, the listening coach adds tips made for this streamer: the server
 * hears the stream (POST /api/live/<token>/listen, driven from here) and
 * every couple of minutes may answer with one.
 * Nothing here is ever shown on stream; the dock is part of OBS's window.
 */

/** A tip or nudge as the server passes it on. */
interface ServerCue {
  id: string;
  kind: CueKind;
  title: string;
  action: string;
  say: string | null;
  tone: Cue["tone"];
  createdAt: string;
}

interface CoachStatus {
  state: "listening" | "busy" | "offline" | "pro" | "cap" | "noaudio" | "error";
  heard: string | null;
  usedHours?: number;
  capHours?: number;
}

const COACH_LINE: Record<CoachStatus["state"], string> = {
  listening: "Listening to your stream",
  busy: "Listening on your other screen",
  offline: "Waiting for your stream",
  pro: "",
  cap: "",
  noaudio: "Can't hear your stream yet. Trying again.",
  error: "Reconnecting…",
};

interface Session {
  id: string;
  startedAt: string;
  endedAt: string | null;
  title: string | null;
  gameName: string | null;
  viewers: number | null;
  peak: number;
  avg: number | null;
  samples: Array<[number, number]>;
  followersStart: number | null;
  followersNow: number | null;
}

interface LiveState {
  live: boolean;
  channel: { login: string; displayName: string };
  pro: boolean;
  freeCoachMinutes: number;
  rankPoints: number | null;
  lastDelta: number | null;
  league: { name: string; place: number; size: number; endsAt: string } | null;
  session: Session | null;
  /** Clips of the live stream, newest first, as Twitch lists them. */
  clips?: Clip[];
  /** Tonight's fix, from their last report. Absent before their first report. */
  fix?: LiveFix | null;
  serverTime: string;
}

interface Clip {
  id: string;
  title: string;
  creator: string;
  createdAt: string;
}

/** A clip older than this is old news by the time Twitch lists it. */
const CLIP_FRESH_MS = 15 * 60_000;

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/** The last stream's report, from /api/live/<token>/report. */
interface StreamReport {
  stream: null | { id: string; title: string | null; endedAt: string | null; live: boolean };
  vod: null | { twitchId: string; title: string; durationSeconds: number | null };
  report: null | {
    id: string;
    status: string;
    sealed: boolean;
    delta: number | null;
    pointsAfter: number | null;
    /** How tonight's fix went, once the result is open. */
    fix?: null | { status: FixStatus; evidence: string };
  };
}

type FixStatus = "fixed" | "partial" | "regressed" | "not_addressed" | "didnt_come_up";
/** The same words the report page uses for the verdict. */
const FIX_VERDICT: Record<FixStatus, string> = {
  fixed: "Did it",
  partial: "Partly",
  regressed: "Slipped",
  not_addressed: "Not yet",
  didnt_come_up: "Didn't come up",
};

/** The panel's sections, which a streamer can hide and reorder (Customize). */
type SectionId = "rank" | "now" | "fix" | "coach" | "numbers" | "graph" | "status" | "earlier";

const SECTIONS: Record<SectionId, string> = {
  rank: "Rank and league",
  now: "Nudges",
  fix: "Tonight's fix",
  coach: "Coach",
  numbers: "Viewers, chatters, followers",
  graph: "Viewer graph",
  status: "Mic, chat and scene",
  earlier: "Earlier nudges",
};

/** The nudges a streamer can turn off, in the order they matter. */
const NUDGES: Array<[CueKind, string]> = [
  ["muted", "Muted mic"],
  ["loudGame", "Game louder than you"],
  ["fix", "Tonight's fix reminder"],
  ["quiet", "Going quiet"],
  ["newChatter", "New chatters"],
  ["raid", "Raids"],
  ["clip", "Clips"],
  ["viewersDown", "Viewers dropping"],
  ["viewersUp", "Viewers climbing"],
  ["chatQuiet", "Quiet chat"],
  ["catchUp", "Catch-up reminders"],
  ["startingScene", "Long starting screen"],
  ["breakScene", "Long breaks"],
];

interface Layout {
  order: SectionId[];
  hidden: SectionId[];
  /** Nudge kinds this device doesn't show or say. */
  off: CueKind[];
}

const DEFAULT_LAYOUT: Layout = { order: ["rank", "now", "fix", "coach", "numbers", "graph", "status", "earlier"], hidden: [], off: [] };
const LAYOUT_KEY = "lc-live-layout-v1";

/**
 * The saved layout. A section added since it was saved goes in after the
 * section it follows by default (the fix card after the nudges), not at
 * the bottom where nobody would find it.
 */
function loadLayout(): Layout {
  try {
    const raw = JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? "null") as Partial<Layout> | null;
    if (!raw) return DEFAULT_LAYOUT;
    const known = (ids: unknown) => (Array.isArray(ids) ? ids.filter((id): id is SectionId => typeof id === "string" && id in SECTIONS) : []);
    const order = known(raw.order);
    DEFAULT_LAYOUT.order.forEach((id, i) => {
      if (order.includes(id)) return;
      const after = i > 0 ? order.indexOf(DEFAULT_LAYOUT.order[i - 1]) : -1;
      order.splice(after + 1, 0, id);
    });
    const kinds = new Set(NUDGES.map(([k]) => k));
    return {
      order,
      hidden: known(raw.hidden),
      off: Array.isArray(raw.off) ? raw.off.filter((k): k is CueKind => kinds.has(k as CueKind)) : [],
    };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

function saveLayout(l: Layout): void {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(l));
  } catch {}
}

/** Pro, from the panel: the dashboard opens with the upgrade window (in their own browser). */
const GET_PRO = "/dashboard?upgrade=1";

/** Chat bots whose messages aren't people asking anything. */
const CHAT_BOTS = new Set(["nightbot", "streamelements", "streamlabs", "moobot", "fossabot", "wizebot", "sery_bot", "soundalerts", "kofistreambot", "botrixoficial", "pokemoncommunitygame"]);
const WELCOME_KEY = "lc-live-welcome-v1";

/** "just now", "3 min ago". Real time, whatever the test speed. */
function ago(ms: number): string {
  const m = Math.floor(ms / 60_000);
  return m < 1 ? "just now" : `${m} min ago`;
}

/** How long after a stream the panel still shows its end screen. */
const END_SCREEN_MS = 12 * 60 * 60_000;

/** Their LevlCast rank, the same one as on the dashboard. */
function RankRow({ points, delta, league }: { points: number | null; delta: number | null; league: LiveState["league"] }) {
  if (points === null) return <p className="ld-rank-none">Unranked. Your first report puts you on the ladder.</p>;
  const rank = rankFromPoints(points);
  const next = nextDivision(rank);
  const toNext = rank.division === null ? null : DIVISION_SIZE - (points % DIVISION_SIZE);
  const gain = delta !== null && Math.abs(delta) < 200 ? delta : 0;
  return (
    <div className="ld-rank" style={{ ["--tier" as string]: TIER_HEX[rank.tier] ?? "#fff" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/ranks/${rank.tier.toLowerCase()}.png`} width={40} height={40} alt="" />
      <div className="ld-rank-b">
        <p className="ld-rank-t">
          <b>{rank.label}</b>
          <span>{points.toLocaleString("en-US")} points</span>
          {gain !== 0 && (
            <span className="ld-rank-d" data-sign={gain > 0 ? "up" : "down"}>
              {gain > 0 ? `+${gain}` : `−${Math.abs(gain)}`}
            </span>
          )}
        </p>
        <div className="ld-rank-bar" aria-hidden="true">
          <i style={{ width: `${rank.progress}%` }} />
        </div>
        <p className="ld-rank-n">{next && toNext !== null ? `${toNext} to ${next}` : next ? `${rank.progress}% of the way to ${next}` : "Top of the ladder"}</p>
        {league && (
          <p className="ld-rank-l">
            <b>{ordinal(league.place)}</b> of {league.size} in {league.name}
          </p>
        )}
      </div>
    </div>
  );
}

/** A number that counts up when it first shows. Still under reduced motion. */
function CountUp({ to, decimals = 0, prefix = "" }: { to: number; decimals?: number; prefix?: string }) {
  const [v, setV] = useState(to);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || to === 0) return setV(to);
    let raf = 0;
    const t0 = performance.now() + 200;
    const tick = (t: number) => {
      const k = Math.min(1, Math.max(0, (t - t0) / 900));
      setV(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    setV(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return (
    <>
      {prefix}
      {v.toFixed(decimals)}
    </>
  );
}

/**
 * The last stream's report: one click to get it, then how it's coming
 * along, then the result. Links open in the streamer's own browser (OBS
 * sends a dock's new-tab links there), where they're signed in.
 */
function ReportCard({ data, origin }: { data: StreamReport | null; origin: string }) {
  if (!data || !data.stream || data.stream.live) return null;
  const r = data.report;
  const open = (href: string, label: string) => (
    <a className="ld-report-go" href={href} target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  );
  if (!data.vod) {
    return (
      <div className="ld-report">
        <p className="ld-k">Your report</p>
        <p className="ld-report-t">Twitch is saving your stream</p>
        <p className="ld-report-s">It takes a few minutes after you end. Your report button shows up here when it&apos;s ready.</p>
      </div>
    );
  }
  const getIt = `${origin}/dashboard/vods?report=${data.vod.twitchId}`;
  if (!r || r.status === "pending" || r.status === "failed") {
    return (
      <div className="ld-report">
        <p className="ld-k">Your report</p>
        <p className="ld-report-t">{r?.status === "failed" ? "The last try didn't finish" : "See how this one went"}</p>
        <p className="ld-report-s">Your rank moves, your clips get found, and you get the one thing to fix next time.</p>
        {open(getIt, r?.status === "failed" ? "Try again" : "Get my report")}
      </div>
    );
  }
  if (r.status === "transcribing" || r.status === "analyzing") {
    return (
      <div className="ld-report">
        <p className="ld-k">Your report</p>
        <p className="ld-report-t">Making your report</p>
        <div className="ld-report-bar" aria-hidden="true">
          <i />
        </div>
        <p className="ld-report-s">Usually about 5 minutes. This updates by itself.</p>
      </div>
    );
  }
  const result = `${origin}/dashboard/vods/${r.id}`;
  if (r.sealed) {
    return (
      <div className="ld-report" data-state="sealed">
        <p className="ld-k">Your report</p>
        <p className="ld-report-t">Your result is in</p>
        <p className="ld-report-s">Win or loss? Call it, then open it.</p>
        {open(result, "Open my result")}
      </div>
    );
  }
  const d = r.delta;
  const placed = d !== null && Math.abs(d) >= 200;
  const after = r.pointsAfter !== null ? rankFromPoints(r.pointsAfter).label : null;
  const before = r.pointsAfter !== null && d !== null && !placed ? rankFromPoints(r.pointsAfter - d).label : null;
  const moved = before !== null && after !== null && before !== after ? (d! > 0 ? "up" : "down") : null;
  return (
    <div className="ld-report" data-state="done">
      <p className="ld-k">Your report</p>
      {d === null ? (
        <p className="ld-report-t">Your report is ready</p>
      ) : (
        <p className="ld-report-res" data-r={placed ? "placed" : d >= 0 ? "win" : "loss"}>
          {placed ? "Placed" : d >= 0 ? "Win" : "Loss"}
          {!placed && <span>{d >= 0 ? `+${d}` : `−${Math.abs(d)}`}</span>}
        </p>
      )}
      {moved === "up" && <p className="ld-report-up">Promoted</p>}
      {after && <p className="ld-report-s">{moved === "down" ? `Dropped to ${after}.` : `You're ${after} now.`}</p>}
      {r.fix && (
        <div className="ld-report-fix" data-status={r.fix.status}>
          <p>
            Tonight&apos;s fix: <b>{FIX_VERDICT[r.fix.status]}</b>
          </p>
          <p className="ld-report-s">{r.fix.evidence}</p>
        </div>
      )}
      {open(result, "See the report")}
    </div>
  );
}

interface ObsConfig {
  enabled: boolean;
  port: number;
  password: string;
  mic: string | null;
  quietSeconds: number;
  /** It has connected on this device before, so trouble now is a problem to fix, not setup. */
  ok: boolean;
}

const OBS_KEY = "lc-live-obs-v1";
const DEFAULT_OBS: ObsConfig = { enabled: false, port: 4455, password: "", mic: null, quietSeconds: 90, ok: false };
/** "Not now" on the Connect OBS card, per device. */
const CONNECT_SKIP_KEY = "lc-live-connect-skip-v1";
/** OBS takes a few seconds to start its server after a restart; trouble only shows once it's lasted this long. */
const OBS_GRACE_MS = 10_000;

/** Louder than this is talking; quieter than QUIET_DB is quiet. In between keeps the last state. */
const TALK_DB = -38;
const QUIET_DB = -45;

/** Audio inputs worth offering as "your mic". */
const AUDIO_KIND = /(input|output)_capture|audio/i;

/** A focused minute of quiet is fine, so the shortest choice is a minute. Older saves (30 or 45 seconds) move up. */
const QUIET_CHOICES: Array<[number, string]> = [
  [60, "1 minute"],
  [90, "90 seconds"],
  [120, "2 minutes"],
  [180, "3 minutes"],
];

function loadObs(): ObsConfig {
  try {
    const raw = localStorage.getItem(OBS_KEY);
    if (raw) {
      const cfg: ObsConfig = { ...DEFAULT_OBS, ...JSON.parse(raw) };
      if (!QUIET_CHOICES.some(([s]) => s === cfg.quietSeconds)) cfg.quietSeconds = DEFAULT_OBS.quietSeconds;
      return cfg;
    }
  } catch {}
  return DEFAULT_OBS;
}

function saveObs(cfg: ObsConfig): void {
  try {
    localStorage.setItem(OBS_KEY, JSON.stringify(cfg));
  } catch {}
}

function duration(ms: number): string {
  const m = Math.round(ms / 60000);
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
}

function Spark({ samples, height = 46 }: { samples: Array<[number, number]>; height?: number }) {
  if (samples.length < 2) return <p className="ld-spark-empty">The viewer graph fills in as you stream.</p>;
  const W = 300;
  const first = samples[0][0];
  const span = Math.max(1, samples[samples.length - 1][0] - first);
  const top = Math.max(1, ...samples.map(([, v]) => v));
  const x = (m: number) => ((m - first) / span) * W;
  const y = (v: number) => height - 3 - (v / top) * (height - 6);
  // A gap of more than 3 minutes (the dock was closed) breaks the line.
  const runs: Array<Array<[number, number]>> = [];
  for (const s of samples) {
    const run = runs[runs.length - 1];
    if (run && s[0] - run[run.length - 1][0] <= 3) run.push(s);
    else runs.push([s]);
  }
  return (
    <svg className="ld-spark" viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" role="img" aria-label="Viewers over the stream">
      {runs.map((run, i) =>
        run.length > 1 ? (
          <polyline key={i} points={run.map(([m, v]) => `${x(m).toFixed(1)},${y(v).toFixed(1)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        ) : (
          <circle key={i} cx={x(run[0][0])} cy={y(run[0][1])} r="1.5" fill="currentColor" />
        )
      )}
    </svg>
  );
}

export default function LiveDock({
  token,
  channel,
  displayName,
  chatUrl,
  speed,
  pollSeconds,
}: {
  token: string;
  channel: string;
  displayName: string;
  chatUrl?: string;
  speed: number;
  pollSeconds: number;
}) {
  const [state, setState] = useState<LiveState | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  /** The link was replaced (or never existed) while the panel was open. */
  const [dead, setDead] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Chat
  const [chatStatus, setChatStatus] = useState<"connecting" | "connected" | "error">("connecting");
  const chatters = useRef(new Set<string>());
  const chatTimes = useRef<number[]>([]);
  const lastChatAt = useRef<number | null>(null);
  /** The last few minutes of chat, for the listening coach. */
  const chatLog = useRef<Array<{ name: string; text: string; at: number; first: boolean }>>([]);
  const [chatterCount, setChatterCount] = useState(0);
  /** Free plan, after its minutes run out: questions asked in chat since, to show what Pro's coach would have caught. */
  const [freeQuestions, setFreeQuestions] = useState(0);
  const freeOverRef = useRef(false);

  // OBS
  const [obsCfg, setObsCfg] = useState<ObsConfig>(DEFAULT_OBS);
  const [obsStatus, setObsStatus] = useState<ObsStatus>("off");
  /** Why it isn't connected. Stays through the retries, so the message doesn't blink. */
  const [obsProblem, setObsProblem] = useState<ObsProblem | null>(null);
  const obsProblemSince = useRef<number | null>(null);
  /** Until the saved choice loads, so the card doesn't flash. */
  const [connectSkipped, setConnectSkipped] = useState(true);
  const [welcomeConnect, setWelcomeConnect] = useState(false);
  const [troubleOpen, setTroubleOpen] = useState(false);
  const [troubleHidden, setTroubleHidden] = useState(false);
  const [inputs, setInputs] = useState<ObsInput[]>([]);
  const [scene, setScene] = useState<string | null>(null);
  const sceneSince = useRef<number | null>(null);
  const lastTalkAt = useRef<number | null>(null);
  const talkingRef = useRef(false);
  /** Since when the mic has been muted in OBS. A muted mic still shows levels, so it can't count as talking. */
  const mutedSince = useRef<number | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const [talking, setTalking] = useState(false);
  const [levelDb, setLevelDb] = useState(-Infinity);
  const levelShownAt = useRef(0);
  /** Whether the game has been drowning out the voice, from both meters. */
  const balance = useRef(new AudioBalance());
  const gameLoud = useRef(false);
  const obsRef = useRef<ObsLink | null>(null);

  // Cues
  const engine = useRef<CueEngine | null>(null);
  if (!engine.current) engine.current = new CueEngine({ quietSeconds: DEFAULT_OBS.quietSeconds, speed });
  const [feed, setFeed] = useState<Cue[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState({ password: "", port: "4455" });
  /** Bumped by Connect, so it reconnects even when nothing in the settings changed. */
  const [attempt, setAttempt] = useState(0);
  const sessionId = useRef<string | null>(null);

  // Voice: nudges spoken into an earbud, meant for a phone (lib/live/voice.ts).
  const [voiceOn, setVoiceOn] = useState(false);
  const [voiceAsk, setVoiceAsk] = useState(false);
  const [lastSaid, setLastSaid] = useState<string | null>(null);
  const [panelSeenAt, setPanelSeenAt] = useState<string | null>(null);
  const [isPhone, setIsPhone] = useState(false);
  /** Known only in the browser, so it starts false to match the server's page. */
  const [canVoice, setCanVoice] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [voicePick, setVoicePick] = useState<VoicePick | null>(null);
  const [voiceSheet, setVoiceSheet] = useState(false);
  const [phoneVoices, setPhoneVoices] = useState<SpeechSynthesisVoice[]>([]);
  const voice = useRef<Voice | null>(null);
  const spoken = useRef(new Set<string>());
  const relayed = useRef(new Set<string>());
  const remoteAfter = useRef<string | null>(null);
  const remoteFirst = useRef(true);

  // The last stream's report, for the end of stream screen.
  const [report, setReport] = useState<StreamReport | null>(null);

  // Customize: the layout, saved on this device, and what's been closed.
  const [layout, setLayout] = useState<Layout>(DEFAULT_LAYOUT);
  const [layoutSheet, setLayoutSheet] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** The first-open welcome, until they press Got it (per device). */
  const [welcomed, setWelcomed] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);
  /** Set when they press Connect, so a successful connection can say so (and not on every page load). */
  const connectAsked = useRef(false);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());

  // The listening coach (Pro).
  const [coachStatus, setCoachStatus] = useState<CoachStatus | null>(null);
  const coachAfter = useRef<string | null>(null);
  const sceneNow = useRef<string | null>(null);
  const obsUp = useRef(false);

  /** False once a free plan's coaching window is over; chat events read it. */
  const coachingRef = useRef(true);
  /** False while a phone just speaks another device's panel nudges. */
  const brainRef = useRef(true);
  const pushCue = useCallback((c: Cue) => {
    if (coachingRef.current && brainRef.current) setFeed((f) => [c, ...f].slice(0, 25));
  }, []);

  // Clips: each one is told once, whether Twitch's list or a link in chat
  // brings it first.
  const seenClips = useRef(new Set<string>());
  const askedClips = useRef(new Set<string>());
  const clipsPrimed = useRef(false);
  const streamTitle = useRef<string | null>(null);
  const clipCue = useCallback(
    (clip: Clip, agoMs: number) => {
      if (seenClips.current.has(clip.id)) return;
      seenClips.current.add(clip.id);
      if (agoMs > CLIP_FRESH_MS || !engine.current) return;
      // A clip keeps the stream's title unless whoever made it renamed it.
      const named = clip.title && clip.title !== streamTitle.current ? clip.title : null;
      pushCue(engine.current.clip(clip.creator, named, agoMs, Date.now()));
    },
    [pushCue]
  );
  /** A clip link in chat: is it a clip of this channel? Twitch can take a few seconds to know a new one. */
  const lookUpClip = useCallback(
    async (id: string) => {
      for (const delay of [0, 12_000]) {
        if (delay) await new Promise((r) => setTimeout(r, delay));
        try {
          const res = await fetch(`/api/live/${token}/clip?id=${encodeURIComponent(id)}`, { cache: "no-store" });
          if (!res.ok) return;
          const json = (await res.json()) as { clip: Clip | null; agoMs: number | null };
          if (json.clip) return clipCue(json.clip, json.agoMs ?? 0);
        } catch {
          return;
        }
      }
    },
    [token, clipCue]
  );

  const updateObs = useCallback((patch: Partial<ObsConfig>) => {
    setObsCfg((c) => {
      const next = { ...c, ...patch };
      saveObs(next);
      return next;
    });
  }, []);

  // Saved OBS settings, once on load. A phone can't reach OBS (it runs on
  // the computer), so phones get voice instead of the OBS button.
  useEffect(() => {
    setIsPhone(window.matchMedia("(pointer: coarse)").matches);
    setCanVoice(Voice.supported());
    setVoicePick(loadVoicePick());
    setLayout(loadLayout());
    try {
      setWelcomed(localStorage.getItem(WELCOME_KEY) === "1");
      setConnectSkipped(localStorage.getItem(CONNECT_SKIP_KEY) === "1");
    } catch {
      setWelcomed(false);
      setConnectSkipped(false);
    }
    const cfg = loadObs();
    setObsCfg(cfg);
    // The password box starts empty: a saved password stays saved, and a
    // paste can't land on the end of the old one.
    setDraft({ password: "", port: String(cfg.port) });
  }, []);

  useEffect(() => {
    if (engine.current) engine.current.tuning = { quietSeconds: obsCfg.quietSeconds, speed };
  }, [obsCfg.quietSeconds, speed]);

  // The device's voices load late in some browsers.
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const load = () => setPhoneVoices(deviceVoices());
    load();
    window.speechSynthesis.addEventListener?.("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", load);
  }, []);

  // The server: viewers, followers, the stream itself. About once a minute.
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      // A failed check tries again sooner, so a panel that opened before the
      // internet did (OBS starting with the computer) catches up quickly.
      let next = pollSeconds * 1000;
      try {
        const res = await fetch(`/api/live/${token}${voiceOn ? "" : "?panel=1"}`, { cache: "no-store" });
        const json = await res.json();
        if (!alive) return;
        if (res.ok) {
          setState(json as LiveState);
          setPollError(null);
          setDead(false);
        } else if (res.status === 404) {
          setDead(true);
        } else {
          setPollError(json.error ?? "Couldn't reach LevlCast. Trying again.");
          next = Math.min(next, 10_000);
        }
      } catch {
        if (alive) setPollError("Can't reach LevlCast. Check your internet. Trying again.");
        next = Math.min(next, 10_000);
      } finally {
        if (alive) timer = setTimeout(load, next);
      }
    };
    void load();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [token, pollSeconds, voiceOn]);

  // A new stream, started while the dock was open, starts with a clean
  // slate. The first answer after opening isn't one: chat that arrived
  // before it belongs to this stream.
  useEffect(() => {
    const id = state?.live ? state.session?.id ?? null : null;
    if (!id) return;
    if (sessionId.current && id !== sessionId.current) {
      chatters.current.clear();
      chatTimes.current = [];
      lastChatAt.current = null;
      setChatterCount(0);
      setFreeQuestions(0);
      balance.current.reset();
      setFeed([]);
    }
    sessionId.current = id;
  }, [state]);

  // Twitch chat, read anonymously.
  useEffect(() => {
    const chat = new TwitchChat(
      channel,
      {
        status: setChatStatus,
        message: (m) => {
          // The streamer typing in their own chat isn't chat being active.
          if (m.user.toLowerCase() === channel.toLowerCase()) return;
          lastChatAt.current = m.at;
          chatTimes.current.push(m.at);
          chatLog.current = [...chatLog.current.filter((c) => m.at - c.at < 4 * 60_000), { name: m.name, text: m.text, at: m.at, first: m.firstTime }].slice(-300);
          if (!chatters.current.has(m.user)) {
            chatters.current.add(m.user);
            setChatterCount(chatters.current.size);
          }
          if (m.firstTime && engine.current) pushCue(engine.current.newChatter(m.name, Date.now()));
          if (freeOverRef.current && !CHAT_BOTS.has(m.user.toLowerCase()) && isQuestion(m.text)) setFreeQuestions((n) => n + 1);
          // A !clip bot or someone sharing a clip: no need to wait for Twitch's list.
          const clipId = clipIdIn(m.text, channel);
          if (clipId && coachingRef.current && brainRef.current && !seenClips.current.has(clipId) && !askedClips.current.has(clipId)) {
            askedClips.current.add(clipId);
            void lookUpClip(clipId);
          }
        },
        raid: (from, viewers) => {
          if (engine.current) pushCue(engine.current.raid(from, viewers, Date.now()));
        },
      },
      chatUrl || undefined
    );
    chat.connect();
    return () => chat.close();
  }, [channel, chatUrl, pushCue, lookUpClip]);

  // Clips as Twitch lists them, a minute or two after they're made. A panel
  // opened mid-stream skips the ones from well before it opened.
  useEffect(() => {
    if (!state?.live) return;
    streamTitle.current = state.session?.title ?? null;
    const at = Date.parse(state.serverTime);
    for (const clip of [...(state.clips ?? [])].reverse()) {
      const age = Math.max(0, at - Date.parse(clip.createdAt));
      if (!clipsPrimed.current && age > 3 * 60_000) seenClips.current.add(clip.id);
      else clipCue(clip, age);
    }
    clipsPrimed.current = true;
  }, [state, clipCue]);

  // OBS on this computer: the mic and the scene. Only when it's been set up.
  useEffect(() => {
    if (!obsCfg.enabled) {
      setObsStatus("off");
      return;
    }
    const link = new ObsLink(
      { port: obsCfg.port, password: obsCfg.password, mic: loadObs().mic },
      {
        status: (s, problem) => {
          setObsStatus(s);
          if (s === "error") {
            setObsProblem(problem ?? "unreachable");
            if (obsProblemSince.current === null) obsProblemSince.current = Date.now();
            // A turned-down password is cleared from the box, so the next paste goes in clean.
            if (problem === "password") setDraft((d) => (d.password ? { ...d, password: "" } : d));
          } else if (s !== "connecting") {
            setObsProblem(null);
            obsProblemSince.current = null;
          }
          if (s === "connected") {
            lastTalkAt.current = Date.now();
            setDraft((d) => (d.password ? { ...d, password: "" } : d));
            setWelcomeConnect(false);
            setTroubleOpen(false);
            setTroubleHidden(false);
            setObsCfg((c) => {
              if (c.ok) return c;
              const next = { ...c, ok: true };
              saveObs(next);
              return next;
            });
            if (connectAsked.current) {
              connectAsked.current = false;
              setSheetOpen(false);
              flash("Connected to OBS. Mic and scene nudges are on.");
            }
          }
        },
        level: (db, gameDb) => {
          const t = Date.now();
          balance.current.add(t, mutedSince.current === null && db > TALK_DB, db, gameDb);
          gameLoud.current = balance.current.drowned();
          if (mutedSince.current !== null) {
            // Viewers hear none of it, so it's not talking.
          } else if (db > TALK_DB) {
            lastTalkAt.current = t;
            if (!talkingRef.current) {
              talkingRef.current = true;
              setTalking(true);
            }
          } else if (db < QUIET_DB && talkingRef.current) {
            talkingRef.current = false;
            setTalking(false);
          }
          if (t - levelShownAt.current > 150) {
            levelShownAt.current = t;
            setLevelDb(db);
          }
        },
        muted: (m) => {
          if (m === (mutedSince.current !== null)) return;
          mutedSince.current = m ? Date.now() : null;
          setMicMuted(m);
          if (m && talkingRef.current) {
            talkingRef.current = false;
            setTalking(false);
          }
          // Unmuting starts the quiet clock fresh rather than counting the muted stretch.
          if (!m) lastTalkAt.current = Date.now();
        },
        scene: (name) => {
          setScene(name);
          sceneSince.current = Date.now();
        },
        streaming: () => {},
        inputs: (list, mic) => {
          setInputs(list);
          if (mic) updateObs({ mic });
        },
      }
    );
    obsRef.current = link;
    link.connect();
    return () => {
      link.close();
      obsRef.current = null;
    };
  }, [obsCfg.enabled, obsCfg.port, obsCfg.password, attempt, updateObs, flash]);

  // One tick a second drives every timer and cue.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const live = Boolean(state?.live);
  const session = state?.session ?? null;
  const liveSince = live && session ? Date.parse(session.startedAt) : null;

  const viewerPoints = useMemo(
    () => (session ? session.samples.map(([m, n]) => ({ at: Date.parse(session.startedAt) + m * 60000, n })) : []),
    [session]
  );

  // Free plans are coached for the first part of each stream, Pro all of it.
  const pro = Boolean(state?.pro);
  const freeMinutes = state?.freeCoachMinutes ?? 30;
  const coachLeftMs = liveSince !== null ? (freeMinutes * 60_000) / speed - (now - liveSince) : Infinity;
  const coaching = live && (pro || coachLeftMs > 0);
  coachingRef.current = coaching;
  freeOverRef.current = live && !pro && !coaching;

  // Tonight's fix leans the nudges toward it: a reminder as the show
  // starts, and the quiet or hello nudges when that's what it's about.
  const fix = state?.fix ?? null;
  const fixLine = fix?.line ?? null;
  const fixOf = fix?.kind ?? null;
  useEffect(() => {
    if (engine.current) engine.current.fix = fixLine && fixOf ? { line: fixLine, kind: fixOf } : null;
  }, [fixLine, fixOf]);

  // A phone in voice mode, with an OBS panel open elsewhere in the last
  // few minutes, speaks that panel's nudges instead of making its own.
  const remotePanel = voiceOn && panelSeenAt !== null && now - Date.parse(panelSeenAt) < 3 * 60_000;
  const brain = !remotePanel;
  brainRef.current = brain;
  sceneNow.current = scene;
  obsUp.current = obsStatus === "connected";

  /** Tips from the server, added once each. */
  const addServerCues = useCallback((list: ServerCue[], prefix: string) => {
    if (!list.length) return;
    const at = Date.now();
    setFeed((f) => {
      const have = new Set(f.map((c) => c.id));
      const incoming = list
        .filter((c) => !have.has(`${prefix}${c.id}`))
        .map((c) => ({ id: `${prefix}${c.id}`, kind: c.kind, title: c.title, action: c.action, tone: c.tone, at, ...(c.say ? { say: c.say } : {}) }));
      return incoming.length ? [...incoming.reverse(), ...f].slice(0, 25) : f;
    });
  }, []);

  const signals: LiveSignals = useMemo(
    () => ({
      now,
      live,
      liveSince,
      viewers: viewerPoints,
      lastChatAt: lastChatAt.current,
      obs:
        obsStatus === "connected"
          ? { lastTalkAt: lastTalkAt.current, scene, sceneSince: sceneSince.current, mutedSince: mutedSince.current, gameLoud: gameLoud.current }
          : null,
    }),
    [now, live, liveSince, viewerPoints, obsStatus, scene, micMuted]
  );

  useEffect(() => {
    if (!engine.current || !coaching || !brain) return;
    const fired = engine.current.tick(signals);
    if (fired.length) setFeed((f) => [...fired.reverse(), ...f].slice(0, 25));
  }, [signals, coaching, brain]);

  // Voice mode: pick up nudges an OBS panel sent, every few seconds, while
  // there's a stream and coaching to speak.
  useEffect(() => {
    if (!voiceOn || !live || !coaching) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const q = remoteAfter.current ? `?after=${encodeURIComponent(remoteAfter.current)}` : "";
        const res = await fetch(`/api/live/${token}/cues${q}`, { cache: "no-store" });
        const json = await res.json();
        if (!alive || !res.ok) return;
        setPanelSeenAt(json.panelSeenAt ?? null);
        const list = (json.cues ?? []) as ServerCue[];
        if (list.length) remoteAfter.current = list[list.length - 1].createdAt;
        // Whatever was said before this phone tuned in stays unsaid. While
        // it works out its own nudges, these are its own, already shown.
        const fresh = remoteFirst.current || brainRef.current ? [] : list;
        remoteFirst.current = false;
        addServerCues(fresh, "r-");
      } catch {
        // Try again next round.
      } finally {
        if (alive) timer = setTimeout(load, Math.max(1000, 5000 / speed));
      }
    };
    void load();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [voiceOn, live, coaching, token, speed, addServerCues]);

  // Offline after a stream: check on its report now and then.
  const lastSessionId = !live ? session?.id ?? null : null;
  const reportWorking = report?.report?.status === "transcribing" || report?.report?.status === "analyzing";
  useEffect(() => {
    if (!lastSessionId) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const res = await fetch(`/api/live/${token}/report`, { cache: "no-store" });
        const json = await res.json();
        if (alive && res.ok) setReport(json as StreamReport);
      } catch {
        // Next round.
      } finally {
        if (alive) timer = setTimeout(load, reportWorking ? 15_000 : 30_000);
      }
    };
    void load();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [lastSessionId, token, reportWorking]);

  // Pro: the listening coach. Whichever device works out the nudges (the
  // OBS panel, or a phone on its own) asks the server to listen; any
  // screen open gets the tips.
  useEffect(() => {
    if (!pro || !live || !brain) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const call = async () => {
      let wait = 30_000;
      try {
        const t = Date.now();
        const res = await fetch(`/api/live/${token}/listen`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            after: coachAfter.current,
            chat: chatLog.current.filter((c) => t - c.at < 4 * 60_000),
            scene: sceneNow.current,
            quietSeconds: obsUp.current && lastTalkAt.current !== null ? Math.round((t - lastTalkAt.current) / 1000) : null,
          }),
        });
        const json = await res.json();
        if (!alive || !res.ok) return;
        wait = Number(json.nextMs) || wait;
        const list = (json.cues ?? []) as ServerCue[];
        if (list.length) coachAfter.current = list[list.length - 1].createdAt;
        addServerCues(list, "s-");
        setCoachStatus((c) => ({ state: json.state, heard: json.heard ?? c?.heard ?? null, usedHours: json.usedHours, capHours: json.capHours }));
      } catch {
        setCoachStatus((c) => ({ ...(c ?? { heard: null }), state: "error" }));
      } finally {
        if (alive) timer = setTimeout(call, Math.min(5 * 60_000, Math.max(5_000, wait)));
      }
    };
    void call();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [pro, live, brain, token, addServerCues]);

  // Voice mode: say the newest nudge. Several at once means the newest wins.
  useEffect(() => {
    if (!voiceOn || !coaching) return;
    const fresh = feed.filter((c) => !spoken.current.has(c.id));
    if (!fresh.length) return;
    fresh.forEach((c) => spoken.current.add(c.id));
    const sayable = fresh.filter((c) => !layoutRef.current.off.includes(c.kind));
    if (!sayable.length) return;
    const line = spokenLine(sayable[0]);
    voice.current?.say(line);
    setLastSaid(line);
  }, [feed, voiceOn, coaching]);

  // Whoever works out the nudges passes them on: for a phone in voice mode
  // to speak, and so the listening coach knows what was already said.
  useEffect(() => {
    if (!brain || !live || !coaching) return;
    // r- came from the server and s- the coach saved itself; only the panel's own go up.
    const fresh = feed.filter((c) => !relayed.current.has(c.id) && !c.id.startsWith("r-") && !c.id.startsWith("s-"));
    if (!fresh.length) return;
    fresh.forEach((c) => relayed.current.add(c.id));
    void fetch(`/api/live/${token}/cues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cues: fresh.map(({ kind, title, action, tone, say }) => ({ kind, title, action, tone, say })) }),
    }).catch(() => {});
  }, [feed, brain, live, coaching, token]);

  // Voice mode keeps the phone's screen on; a locked phone stops talking.
  useEffect(() => {
    if (!voiceOn || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let alive = true;
    const get = async () => {
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch {
        // Not allowed here; the phone may dim on its own schedule.
      }
    };
    void get();
    const onVisible = () => {
      if (alive && document.visibilityState === "visible") void get();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => {});
    };
  }, [voiceOn]);

  const coachShown = !layout.hidden.includes("coach");
  /** A nudge that's true for a while (quiet, muted) is closed for that stretch; the rest one by one. */
  const cueKey = (c: Cue) => (SHOW_FOR[c.kind] === 0 ? `${c.kind}:${c.at}` : c.id);
  const shownKind = (c: Cue) => !layout.off.includes(c.kind) && !(c.kind === "coach" && coachShown);
  const rawCurrent = engine.current && coaching ? engine.current.current(signals) : null;
  const current = rawCurrent && shownKind(rawCurrent) && !dismissed.has(cueKey(rawCurrent)) ? rawCurrent : null;
  const card = coaching ? nowCue(current, feed.filter((c) => shownKind(c) && !dismissed.has(cueKey(c))), now, speed) : null;
  const dismiss = (c: Cue) => setDismissed((d) => new Set(d).add(cueKey(c)));
  const earlier = feed.filter(shownKind).slice(0, 5);
  const coachTips = feed.filter((c) => c.kind === "coach");
  const latestTip = coachTips.find((c) => !dismissed.has(cueKey(c))) ?? null;
  const olderTips = coachTips.filter((c) => c !== latestTip).slice(0, 3);

  const updateLayout = (next: Layout) => {
    setLayout(next);
    saveLayout(next);
  };
  const moveSection = (id: SectionId, by: -1 | 1) => {
    const order = [...layout.order];
    const i = order.indexOf(id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    updateLayout({ ...layout, order });
  };
  const toggleSection = (id: SectionId) =>
    updateLayout({ ...layout, hidden: layout.hidden.includes(id) ? layout.hidden.filter((h) => h !== id) : [...layout.hidden, id] });
  const toggleNudge = (kind: CueKind) =>
    updateLayout({ ...layout, off: layout.off.includes(kind) ? layout.off.filter((k) => k !== kind) : [...layout.off, kind] });

  // Chat speed: messages in the last minute.
  chatTimes.current = chatTimes.current.filter((t) => now - t < 5 * 60_000);
  const perMinute = chatTimes.current.filter((t) => now - t < 60_000).length;

  const followersGained =
    session && session.followersStart !== null && session.followersNow !== null ? session.followersNow - session.followersStart : null;
  const quietFor = lastTalkAt.current !== null ? now - lastTalkAt.current : 0;
  const meter = Number.isFinite(levelDb) ? Math.max(0, Math.min(100, ((levelDb + 60) / 60) * 100)) : 0;

  const obsLabel =
    obsStatus === "connected" ? "OBS connected" : obsStatus === "connecting" ? "Connecting to OBS" : obsCfg.enabled ? "OBS not connected" : "Connect OBS";

  const micInputs = inputs.filter((i) => AUDIO_KIND.test(i.kind));

  // Pro starts on a natural voice; free on the device's best. A pick of a
  // natural voice that's no longer allowed falls back too.
  const firstPhoneVoice = phoneVoices[0]?.voiceURI ?? "";
  const pickNow: VoicePick = useMemo(
    () => (voicePick && (voicePick.kind === "device" || pro) ? voicePick : pro ? { kind: "levl", id: "thalia" } : { kind: "device", id: firstPhoneVoice }),
    [voicePick, pro, firstPhoneVoice]
  );
  // The plan arrives a moment after the page opens. Voice started before
  // then moves to the right voice once it's known.
  useEffect(() => {
    if (voice.current) voice.current.pick = pickNow;
  }, [pickNow]);
  const pickLabel =
    pickNow.kind === "levl"
      ? LEVL_VOICES.find((v) => v.id === pickNow.id)?.name ?? "Thalia"
      : (() => {
          const v = phoneVoices.find((x) => x.voiceURI === pickNow.id) ?? phoneVoices[0];
          return v ? voiceName(v) : "your phone's voice";
        })();

  const choose = (pick: VoicePick) => {
    setVoicePick(pick);
    saveVoicePick(pick);
    if (voice.current) voice.current.pick = pick;
  };
  const preview = (pick: VoicePick) => {
    if (!voice.current) voice.current = new Voice(token, pickNow);
    voice.current.preview(pick, "sample", SAMPLE_LINES.sample);
  };

  const s = session;
  const sections: Record<SectionId, () => ReactNode> = {
    rank: () => <RankRow points={state?.rankPoints ?? null} delta={state?.lastDelta ?? null} league={state?.league ?? null} />,
    // Shown all stream, Free included: it's their own report, not a nudge.
    fix: () =>
      fix ? (
        <section className="ld-fix" aria-label="Tonight's fix">
          <p className="ld-k">Tonight&apos;s fix</p>
          <p className="ld-fix-t">{fix.line}</p>
          <p className="ld-fix-s">From your last report. Your next report checks it.</p>
        </section>
      ) : null,
    now: () =>
      coaching ? (
        <section className="ld-now" data-tone={card?.tone ?? "calm"}>
          {card && (
            <button type="button" className="ld-x" onClick={() => dismiss(card)} aria-label="Dismiss" title="Dismiss">
              <X size={14} strokeWidth={2.2} aria-hidden="true" />
            </button>
          )}
          <p className="ld-k">Now</p>
          <p className="ld-now-t">{card ? card.title : "Looking good"}</p>
          <p className="ld-now-a">{card ? card.action : talking ? "Keep it up." : "Keep talking to chat."}</p>
          {voiceOn && (
            <p className="ld-voiceline">
              {remotePanel ? "Speaking your OBS panel's nudges" : "Speaking your nudges"} in {pickLabel}&apos;s voice.{" "}
              <button type="button" onClick={() => setVoiceSheet(true)}>
                Change
              </button>
              {lastSaid && <span> Last: {lastSaid}</span>}
            </p>
          )}
          {!pro && Number.isFinite(coachLeftMs) && (
            <p className="ld-plan">Free plan: {Math.max(1, Math.ceil((coachLeftMs * speed) / 60_000))} min of nudges left this stream.</p>
          )}
        </section>
      ) : (
        <section className="ld-now ld-now-off" data-tone="calm">
          <p className="ld-k">Nudges</p>
          <p className="ld-now-t">Off for the rest of this stream</p>
          {/* Questions are counted from chat in the panel, no AI: it can't tell
              which ones got answered, so it only says how many were asked. */}
          <p className="ld-now-a">
            {freeQuestions > 0
              ? `Since your free ${freeMinutes} minutes ended, chat has asked ${freeQuestions} ${freeQuestions === 1 ? "question" : "questions"}. Pro's coach listens and tells you which ones you missed.`
              : `Free covers the first ${freeMinutes} minutes of each stream. Pro covers all of it.`}{" "}
            <a href={GET_PRO} target="_blank" rel="noopener noreferrer">
              See Pro
            </a>
          </p>
        </section>
      ),
    coach: () => {
      // On a free plan with no Pro panel feeding it: one line about what it is.
      if (!pro && !remotePanel) {
        return (
          <section className="ld-coach" aria-label="Your coach">
            <div className="ld-coach-h">
              <p className="ld-k">Coach</p>
              <span className="ld-pro">Pro</span>
            </div>
            <p className="ld-coach-p">
              Listens to your stream and tells you what to do, like a question you missed or a play to talk chat through.{" "}
              <a href={GET_PRO} target="_blank" rel="noopener noreferrer">
                See Pro
              </a>
            </p>
          </section>
        );
      }
      const st = coachStatus?.state;
      const status = coachStatus
        ? st === "cap"
          ? `Used this month's ${coachStatus.capHours ?? ""} hours`
          : COACH_LINE[coachStatus.state]
        : remotePanel
          ? "From your OBS panel"
          : "Starting up";
      const heard = st === "listening" ? coachStatus?.heard : null;
      return (
        <section className="ld-coach" aria-label="Your coach">
          <div className="ld-coach-h">
            <p className="ld-k">Coach</p>
            <span className="ld-coach-s" data-state={st ?? "remote"}>
              {status}
            </span>
          </div>
          {latestTip ? (
            <div className="ld-tip" data-tone={latestTip.tone}>
              <button type="button" className="ld-x" onClick={() => dismiss(latestTip)} aria-label="Dismiss this tip" title="Dismiss">
                <X size={14} strokeWidth={2.2} aria-hidden="true" />
              </button>
              <p className="ld-tip-t">{latestTip.title}</p>
              <p className="ld-tip-a">{latestTip.action}</p>
              <p className="ld-tip-at">{ago(Date.now() - latestTip.at)}</p>
            </div>
          ) : (
            <p className="ld-coach-p">
              Every couple of minutes it tells you one thing worth doing, like answering a question you missed or talking chat through a
              play.
            </p>
          )}
          {olderTips.length > 0 && (
            <ul className="ld-tips">
              {olderTips.map((c) => (
                <li key={c.id}>
                  <span className="ld-at">{liveSince !== null ? clock(Math.max(0, c.at - liveSince)) : ""}</span>
                  <span>{c.action}</span>
                </li>
              ))}
            </ul>
          )}
          {heard && <p className="ld-heard">Heard: &ldquo;{heard}&rdquo;</p>}
        </section>
      );
    },
    numbers: () =>
      s ? (
        <div className="ld-stats">
          <div>
            <b>{s.viewers ?? "-"}</b>
            <span>Viewers</span>
          </div>
          <div>
            <b>{s.peak}</b>
            <span>Peak</span>
          </div>
          <div>
            <b>{chatterCount}</b>
            <span>Chatters</span>
          </div>
          <div>
            <b>{followersGained === null ? "-" : `${followersGained >= 0 ? "+" : ""}${followersGained}`}</b>
            <span>Followers</span>
          </div>
        </div>
      ) : null,
    graph: () => (s ? <Spark samples={s.samples} /> : null),
    status: () => (
      <div className="ld-lines">
        {obsStatus === "connected" ? (
          <p>
            <span className="ld-l">Mic</span>
            <span className="ld-meter" aria-hidden="true">
              <i style={{ width: `${meter}%` }} data-talking={talking ? "1" : "0"} />
            </span>
            <span className="ld-v" data-muted={micMuted ? "1" : "0"}>
              {micMuted ? "Muted in OBS" : talking ? "Talking" : `Quiet ${clock(quietFor * speed)}`}
            </span>
          </p>
        ) : isPhone ? (
          <p className="ld-hint">
            {remotePanel ? "Mic and scene nudges come from your OBS panel." : "Open this link in an OBS panel on your computer to also get mic and scene nudges."}
          </p>
        ) : obsCfg.enabled || obsCard ? null : (
          <p className="ld-hint">
            <button type="button" onClick={() => setSheetOpen(true)}>
              Connect OBS
            </button>{" "}
            to get told when you go quiet or stay on your starting screen.
          </p>
        )}
        <p>
          <span className="ld-l">Chat</span>
          <span className="ld-v">
            {chatStatus === "connected" ? `${perMinute} ${perMinute === 1 ? "message" : "messages"} a minute` : chatStatus === "connecting" ? "Connecting…" : "Reconnecting…"}
          </span>
        </p>
        {scene && (
          <p>
            <span className="ld-l">Scene</span>
            <span className="ld-v">{scene}</span>
          </p>
        )}
      </div>
    ),
    earlier: () =>
      earlier.length > 0 ? (
        <section className="ld-feed">
          <p className="ld-k">Earlier</p>
          <ul>
            {earlier.map((c) => (
              <li key={c.id} data-tone={c.tone} data-kind={c.kind}>
                <span className="ld-at">{liveSince !== null ? clock(Math.max(0, c.at - liveSince)) : ""}</span>
                <span>
                  {c.kind === "coach" && <b className="ld-tag">Coach</b>}
                  {c.kind === "coach" ? c.action : c.title}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null,
  };

  const showWelcome = Boolean(state) && !live && !welcomed;
  const dismissWelcome = () => {
    setWelcomed(true);
    try {
      localStorage.setItem(WELCOME_KEY, "1");
    } catch {}
  };
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  const startVoice = () => {
    if (!voice.current) voice.current = new Voice(token, pickNow);
    voice.current.pick = pickNow;
    // Nothing from before gets read out; and saying something inside the
    // tap is what lets a phone speak later without one.
    feed.forEach((c) => spoken.current.add(c.id));
    voice.current.start(SAMPLE_LINES.on);
    remoteFirst.current = true;
    setVoiceAsk(false);
    setSettingsOpen(false);
    setVoiceOn(true);
    flash("Voice is on. Keep this page open while you stream.");
  };
  const stopVoice = () => {
    voice.current?.stop();
    setVoiceOn(false);
  };
  const toggleVoice = () => {
    if (voiceOn) stopVoice();
    else if (isPhone) startVoice();
    else setVoiceAsk(true);
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}`);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1600);
    } catch {
      // Copy it from the address bar instead.
    }
  };

  const connect = () => {
    connectAsked.current = true;
    const port = Number(draft.port) || 4455;
    // An empty box keeps the saved password, unless OBS just turned that one down.
    const password = draft.password.trim() || (obsProblem === "password" ? "" : obsCfg.password);
    updateObs({ enabled: true, port, password });
    setAttempt((n) => n + 1);
  };
  const skipConnect = () => {
    setConnectSkipped(true);
    try {
      localStorage.setItem(CONNECT_SKIP_KEY, "1");
    } catch {}
    // Stop trying with a password that never worked.
    if (!obsCfg.ok) updateObs({ enabled: false });
    flash("You can connect OBS any time from the OBS button up top.");
  };

  // Connecting OBS, in the open rather than behind a button: a card the
  // first time (until it works or they say not now), and a line at the top
  // when one that worked before stops.
  const desktop = !isPhone && Boolean(state) && !dead;
  const autoConnecting = obsCfg.enabled && obsStatus !== "error" && obsProblem === null && !connectAsked.current;
  const obsCard = desktop && obsStatus !== "connected" && !obsCfg.ok && !connectSkipped && !showWelcome && !autoConnecting;
  const obsTrouble =
    desktop &&
    obsStatus !== "connected" &&
    obsCfg.ok &&
    obsCfg.enabled &&
    !troubleHidden &&
    (troubleOpen || (obsProblem !== null && (obsProblem === "password" || now - (obsProblemSince.current ?? now) > OBS_GRACE_MS)));
  const obsStatusLine =
    obsStatus === "connected"
      ? "Connected."
      : obsProblem === "password"
        ? obsCfg.password
          ? "That password didn't work. Copy it again from Show Connect Info and paste it here."
          : "OBS needs its password. Copy it from Show Connect Info and paste it here."
        : obsProblem === "lost"
          ? "Lost the connection to OBS. Trying again."
          : obsProblem === "unreachable"
            ? `Can't reach OBS yet. Check the WebSocket server is on and the port is ${obsCfg.port}. Trying again.`
            : obsStatus === "connecting"
              ? "Connecting…"
              : null;

  /** The steps, the password and Connect. Shown in the card, the welcome, the trouble line and the OBS sheet. */
  const obsForm = (extra?: ReactNode, inSheet = false) => {
    if (sheetOpen && !inSheet) return null;
    return (
      <div className="ld-cform">
        {obsStatus !== "connected" && (
          <ol className="ld-steps">
            <li>
              In OBS, open <b>Tools</b>, then <b>WebSocket Server Settings</b>, and tick <b>Enable WebSocket server</b>.
            </li>
            <li>
              Click <b>Show Connect Info</b> and copy the <b>Server Password</b>.
            </li>
            <li>Paste it here and press Connect.</li>
          </ol>
        )}
        <div className="ld-cfields">
          <label className="ld-field">
            <span>Password</span>
            <input
              type="password"
              value={draft.password}
              placeholder={obsCfg.password && obsProblem !== "password" ? "Saved on this computer" : "Paste it here"}
              onChange={(e) => setDraft((d) => ({ ...d, password: e.target.value }))}
              onFocus={(e) => e.currentTarget.select()}
              onKeyDown={(e) => e.key === "Enter" && connect()}
              autoComplete="off"
            />
          </label>
          <label className="ld-field ld-field-small">
            <span>Port</span>
            <input
              inputMode="numeric"
              value={draft.port}
              onChange={(e) => setDraft((d) => ({ ...d, port: e.target.value.replace(/\D/g, "") }))}
              onKeyDown={(e) => e.key === "Enter" && connect()}
            />
          </label>
        </div>
        <div className="ld-row">
          <button type="button" className="ld-btn" onClick={connect}>
            {obsStatus === "connected" ? "Reconnect" : "Connect"}
          </button>
          {extra}
        </div>
        {obsStatusLine && (
          <p className="ld-status" data-state={obsStatus === "connected" ? "connected" : obsProblem ? "error" : "connecting"} role="status">
            {obsStatusLine}
          </p>
        )}
      </div>
    );
  };

  if (dead) {
    return (
      <div className="ld">
        <DeadLink />
      </div>
    );
  }

  return (
    <div className="ld">
      <header className="ld-top">
        <span className="ld-state" data-live={live ? "1" : "0"}>
          <i aria-hidden="true" />
          {live ? <>Live {liveSince !== null ? clock(now - liveSince) : ""}</> : "Offline"}
        </span>
        <span className="ld-who">{displayName}</span>
        {state && (
          <button type="button" className="ld-tier" data-pro={pro ? "1" : "0"} onClick={() => setSettingsOpen(true)} title={pro ? "You're on Pro" : "See what Pro adds"}>
            {pro ? "Pro" : "Free"}
          </button>
        )}
        {(canVoice || voiceOn) && (
          <button type="button" className="ld-voice" data-on={voiceOn ? "1" : "0"} onClick={toggleVoice} aria-pressed={voiceOn}>
            {voiceOn ? "Voice on" : "Voice"}
          </button>
        )}
        {!isPhone && (
          <button type="button" className="ld-obs" data-state={obsStatus} onClick={() => setSheetOpen(true)} title={obsLabel}>
            {obsStatus === "off" && !obsCfg.enabled ? "Connect OBS" : obsStatus === "connecting" ? "OBS…" : "OBS"}
          </button>
        )}
        <button type="button" className="ld-icon" onClick={() => setSettingsOpen(true)} aria-label="Settings" title="Settings">
          <Settings size={15} strokeWidth={2} aria-hidden="true" />
        </button>
      </header>

      {toast && (
        <p className="ld-toast" role="status">
          {toast}
        </p>
      )}

      {obsTrouble && (
        <section className="ld-trouble" aria-label="OBS isn't connected">
          <div className="ld-trouble-h">
            <p>{obsProblem === "password" ? "OBS says the password is wrong" : obsProblem ? "Can't reach OBS" : "Connecting to OBS…"}</p>
            <button type="button" className="ld-link" onClick={() => setTroubleOpen((o) => !o)}>
              {troubleOpen ? "Close" : obsProblem === "password" ? "Fix it" : "Help"}
            </button>
            {!troubleOpen && (
              <button type="button" className="ld-x" onClick={() => setTroubleHidden(true)} aria-label="Hide this" title="Hide">
                <X size={14} strokeWidth={2.2} aria-hidden="true" />
              </button>
            )}
          </div>
          {troubleOpen && obsForm()}
        </section>
      )}

      {obsCard && (
        <section className="ld-connect" aria-label="Connect OBS">
          <p className="ld-connect-t">Connect OBS</p>
          <p className="ld-connect-s">So it can tell when your mic is muted or you&apos;ve gone quiet.</p>
          {obsForm(
            <button type="button" className="ld-link" onClick={skipConnect}>
              Not now
            </button>
          )}
        </section>
      )}

      {showWelcome && (
        <section className="ld-welcome" aria-label="You're all set">
          <svg className="ld-welcome-check" viewBox="0 0 48 48" aria-hidden="true">
            <circle cx="24" cy="24" r="21" />
            <path d="M14.5 24.5l6.5 6.5L33.5 18" />
          </svg>
          <p className="ld-welcome-t">You&apos;re all set</p>
          <p className="ld-welcome-s">
            {isPhone ? "LevlCast is on your phone. Only you can hear it." : "LevlCast is in OBS. Only you can see it, never your viewers."}
          </p>
          <ul className="ld-checks">
            {isPhone ? (
              <>
                <li data-done="1">
                  <i aria-hidden="true" />
                  <span>Opened on your phone</span>
                </li>
                <li data-done={voiceOn ? "1" : "0"}>
                  <i aria-hidden="true" />
                  <span>Turn on Voice and put in one earbud</span>
                  {!voiceOn && (
                    <button type="button" onClick={startVoice}>
                      Turn on
                    </button>
                  )}
                </li>
                <li data-done="0">
                  <i aria-hidden="true" />
                  <span>Keep the panel open in OBS on your computer too</span>
                </li>
              </>
            ) : (
              <>
                <li data-done="1">
                  <i aria-hidden="true" />
                  <span>Added to OBS</span>
                </li>
                <li data-done={obsStatus === "connected" ? "1" : "0"} data-open={welcomeConnect && obsStatus !== "connected" ? "1" : "0"}>
                  <i aria-hidden="true" />
                  <span>Connect OBS so it knows when your mic goes quiet</span>
                  {obsStatus !== "connected" && !welcomeConnect && (
                    <button type="button" onClick={() => setWelcomeConnect(true)}>
                      Connect
                    </button>
                  )}
                  {welcomeConnect && obsStatus !== "connected" && obsForm()}
                </li>
                <li data-done="0">
                  <i aria-hidden="true" />
                  <span>Want it in your ear? Use voice on your phone</span>
                  <button type="button" onClick={() => setVoiceAsk(true)}>
                    How
                  </button>
                </li>
              </>
            )}
            <li data-done="0">
              <i aria-hidden="true" />
              <span>Go live. It fills in by itself.</span>
            </li>
          </ul>
          <button type="button" className="ld-btn" onClick={dismissWelcome}>
            Got it
          </button>
        </section>
      )}

      {!state && !pollError && <p className="ld-wait">Checking your stream…</p>}

      {state && !live && !layout.hidden.includes("rank") && (
        <RankRow points={state.rankPoints ?? null} delta={state.lastDelta ?? null} league={state.league ?? null} />
      )}

      {state && live && session && (
        <>
          {layout.order
            .filter((id) => !layout.hidden.includes(id))
            .map((id) => (
              <Fragment key={id}>{sections[id]()}</Fragment>
            ))}
        </>
      )}

      {state && !live && session && session.endedAt && now - Date.parse(session.endedAt) < END_SCREEN_MS && (
        <section className="ld-gg" aria-label="Your stream is over">
          <p className="ld-gg-t">GG</p>
          <p className="ld-gg-s">
            Stream over &middot; {duration(Date.parse(session.endedAt) - Date.parse(session.startedAt))} &middot;{" "}
            {new Date(session.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </p>
          <div className="ld-stats">
            <div>
              <b>
                <CountUp to={session.peak} />
              </b>
              <span>Peak</span>
            </div>
            <div>
              <b>{session.avg === null ? "-" : <CountUp to={session.avg} decimals={session.avg < 10 ? 1 : 0} />}</b>
              <span>Average</span>
            </div>
            <div>
              <b>{followersGained === null ? "-" : <CountUp to={followersGained} prefix={followersGained >= 0 ? "+" : ""} />}</b>
              <span>Followers</span>
            </div>
          </div>
          {session.samples.length > 1 && <Spark samples={session.samples} />}
          <ReportCard data={report} origin={typeof window === "undefined" ? "" : window.location.origin} />
        </section>
      )}

      {state && !live && !(showWelcome && !session) && !(session && session.endedAt && now - Date.parse(session.endedAt) < END_SCREEN_MS) && (
        <section className="ld-off">
          <p className="ld-off-t">You&apos;re offline</p>
          <p className="ld-off-s">Go live and this fills in. Keep it open while you stream.</p>
          {session ? (
            <div className="ld-last">
              <p className="ld-k">
                Last stream &middot; {new Date(session.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} &middot;{" "}
                {duration(Date.parse(session.endedAt ?? session.startedAt) - Date.parse(session.startedAt))}
              </p>
              <div className="ld-stats">
                <div>
                  <b>{session.peak}</b>
                  <span>Peak</span>
                </div>
                <div>
                  <b>{session.avg === null ? "-" : session.avg.toFixed(session.avg < 10 ? 1 : 0)}</b>
                  <span>Average</span>
                </div>
                <div>
                  <b>{followersGained === null ? "-" : `${followersGained >= 0 ? "+" : ""}${followersGained}`}</b>
                  <span>Followers</span>
                </div>
              </div>
              <Spark samples={session.samples} />
              <ReportCard data={report} origin={typeof window === "undefined" ? "" : window.location.origin} />
            </div>
          ) : showWelcome ? null : (
            <ul className="ld-how">
              <li>
                <b>While you&apos;re live</b> it tells you when you go quiet, who&apos;s new in chat and how your viewers are doing.
              </li>
              <li>
                <b>After</b> you get a recap and your report, right here.
              </li>
            </ul>
          )}
          {obsStatus !== "connected" && !obsCfg.enabled && !showWelcome && !obsCard && (
            <p className="ld-hint">
              <button type="button" onClick={() => setSheetOpen(true)}>
                Connect OBS
              </button>{" "}
              before you go live for mic and scene coaching.
            </p>
          )}
        </section>
      )}

      {pollError && <p className="ld-err">{pollError}</p>}

      <footer className="ld-foot">{isPhone ? "Only you can see and hear this. Your viewers never will." : "Only you can see this. It's part of OBS, not your stream."}</footer>

      {voiceAsk && (
        <div className="ld-sheet" role="dialog" aria-modal="true" aria-label="Voice coaching">
          <div className="ld-sheet-in">
            <div className="ld-sheet-head">
              <p>Voice works best on your phone</p>
              <button type="button" onClick={() => setVoiceAsk(false)}>
                Close
              </button>
            </div>
            <p className="ld-help">
              Anything this computer plays out loud can end up on your stream if OBS records your desktop audio.
            </p>
            <ol className="ld-steps">
              <li>Open this same link on your phone.</li>
              <li>
                Put in one earbud and tap <b>Voice</b> there.
              </li>
              <li>Keep this panel open here. It hears your mic and sees your scenes, and passes its nudges to your phone.</li>
            </ol>
            <div className="ld-row">
              <button type="button" className="ld-btn" onClick={copyLink}>
                {linkCopied ? "Copied" : "Copy the link"}
              </button>
              <button type="button" className="ld-link" onClick={startVoice}>
                Use voice here anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="ld-sheet" role="dialog" aria-modal="true" aria-label="Settings">
          <div className="ld-sheet-in">
            <div className="ld-sheet-head">
              <p>Settings</p>
              <button type="button" onClick={() => setSettingsOpen(false)}>
                Done
              </button>
            </div>

            <section className="ld-set">
              <p className="ld-k">Your plan</p>
              {pro ? (
                <>
                  <p className="ld-set-t">You&apos;re on Pro</p>
                  <p className="ld-set-s">
                    Your coach listens all stream, and you get the natural voices.
                    {coachStatus?.capHours ? ` ${coachStatus.usedHours ?? 0} of ${coachStatus.capHours} coach hours used this month.` : ""}
                  </p>
                </>
              ) : (
                <>
                  <p className="ld-set-t">You&apos;re on Free</p>
                  <ul className="ld-set-list">
                    <li>A coach that listens to your stream and tells you what to do</li>
                    <li>Coaching for the whole stream, not just the first 30 minutes</li>
                    <li>More voices to pick from</li>
                  </ul>
                  <a className="ld-report-go" href={`${origin}${GET_PRO}`} target="_blank" rel="noopener noreferrer">
                    Get Pro
                  </a>
                </>
              )}
            </section>

            <section className="ld-set">
              <p className="ld-k">Voice</p>
              <div className="ld-set-row">
                <span>Read nudges out loud</span>
                <button type="button" className="ld-switch" role="switch" aria-checked={voiceOn} onClick={toggleVoice} data-on={voiceOn ? "1" : "0"}>
                  <i />
                </button>
              </div>
              <div className="ld-set-row">
                <span>
                  Voice: <b>{pickLabel}</b>
                </span>
                <button type="button" className="ld-link" onClick={() => setVoiceSheet(true)}>
                  Change
                </button>
              </div>
              <p className="ld-set-s">Best on your phone with one earbud. Anything this computer plays can end up on stream.</p>
            </section>

            {!isPhone && (
              <section className="ld-set">
                <p className="ld-k">OBS</p>
                <div className="ld-set-row">
                  <span className="ld-set-obs" data-state={obsStatus}>
                    {obsStatus === "connected" ? `Connected${obsCfg.mic ? ` · ${obsCfg.mic}` : ""}` : obsStatus === "connecting" ? "Connecting…" : "Not connected"}
                  </span>
                  <button type="button" className="ld-link" onClick={() => setSheetOpen(true)}>
                    {obsStatus === "connected" ? "Settings" : "Connect"}
                  </button>
                </div>
              </section>
            )}

            <section className="ld-set">
              <p className="ld-k">This panel</p>
              <div className="ld-set-row">
                <span>Pick what shows and in what order</span>
                <button type="button" className="ld-link" onClick={() => setLayoutSheet(true)}>
                  Customize
                </button>
              </div>
              <div className="ld-set-row">
                <span>Everything it does, step by step</span>
                <a className="ld-link" href={`${origin}/dashboard/live`} target="_blank" rel="noopener noreferrer">
                  How it works
                </a>
              </div>
            </section>
          </div>
        </div>
      )}

      {layoutSheet && (
        <div className="ld-sheet" role="dialog" aria-modal="true" aria-label="Customize your panel">
          <div className="ld-sheet-in">
            <div className="ld-sheet-head">
              <p>Customize your panel</p>
              <button type="button" onClick={() => setLayoutSheet(false)}>
                Done
              </button>
            </div>
            <p className="ld-help">Pick what shows while you&apos;re live, and in what order. It&apos;s saved on this device.</p>
            <ul className="ld-lay">
              {layout.order.map((id, i) => (
                <li key={id} data-off={layout.hidden.includes(id) ? "1" : "0"}>
                  <label>
                    <input type="checkbox" checked={!layout.hidden.includes(id)} onChange={() => toggleSection(id)} />
                    <span>{SECTIONS[id]}</span>
                  </label>
                  <span className="ld-lay-move">
                    <button type="button" onClick={() => moveSection(id, -1)} disabled={i === 0} aria-label={`Move ${SECTIONS[id]} up`}>
                      <ChevronUp size={15} aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => moveSection(id, 1)} disabled={i === layout.order.length - 1} aria-label={`Move ${SECTIONS[id]} down`}>
                      <ChevronDown size={15} aria-hidden="true" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <p className="ld-k">Nudges to show</p>
            <ul className="ld-lay">
              {NUDGES.map(([kind, name]) => (
                <li key={kind}>
                  <label>
                    <input type="checkbox" checked={!layout.off.includes(kind)} onChange={() => toggleNudge(kind)} />
                    <span>{name}</span>
                  </label>
                </li>
              ))}
            </ul>
            <button type="button" className="ld-link" onClick={() => updateLayout(DEFAULT_LAYOUT)}>
              Back to how it was
            </button>
          </div>
        </div>
      )}

      {voiceSheet && (
        <div className="ld-sheet" role="dialog" aria-modal="true" aria-label="Pick a voice">
          <div className="ld-sheet-in">
            <div className="ld-sheet-head">
              <p>Pick a voice</p>
              <button type="button" onClick={() => setVoiceSheet(false)}>
                Done
              </button>
            </div>
            <p className="ld-k">
              LevlCast voices{!pro && <span className="ld-pro"> Pro</span>}
            </p>
            <ul className="ld-voices">
              {LEVL_VOICES.map((v) => {
                const on = pickNow.kind === "levl" && pickNow.id === v.id;
                return (
                  <li key={v.id} data-on={on ? "1" : "0"}>
                    <button type="button" className="ld-voice-pick" disabled={!pro} onClick={() => choose({ kind: "levl", id: v.id })} aria-pressed={on}>
                      <b>{v.name}</b> <span>{v.note}</span>
                    </button>
                    <button type="button" className="ld-play" onClick={() => preview({ kind: "levl", id: v.id })}>
                      Play
                    </button>
                  </li>
                );
              })}
            </ul>
            {!pro && (
              <p className="ld-help">
                These come with Pro.{" "}
                <a href={GET_PRO} target="_blank" rel="noopener noreferrer">
                  See Pro
                </a>
              </p>
            )}
            {phoneVoices.length > 0 && (
              <>
                <p className="ld-k">This {isPhone ? "phone's" : "device's"} voices</p>
                <ul className="ld-voices">
                  {phoneVoices.map((v) => {
                    const on = pickNow.kind === "device" && pickNow.id === v.voiceURI;
                    return (
                      <li key={v.voiceURI} data-on={on ? "1" : "0"}>
                        <button type="button" className="ld-voice-pick" onClick={() => choose({ kind: "device", id: v.voiceURI })} aria-pressed={on}>
                          <b>{voiceName(v)}</b> <span>{voiceNote(v)}</span>
                        </button>
                        <button type="button" className="ld-play" onClick={() => preview({ kind: "device", id: v.voiceURI })}>
                          Play
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <p className="ld-help">Phones can download better voices in their settings, under accessibility or text to speech.</p>
              </>
            )}
          </div>
        </div>
      )}

      {sheetOpen && (
        <div className="ld-sheet" role="dialog" aria-modal="true" aria-label="Connect OBS">
          <div className="ld-sheet-in">
            <div className="ld-sheet-head">
              <p>Connect OBS</p>
              <button type="button" onClick={() => setSheetOpen(false)}>
                Done
              </button>
            </div>
            <p className="ld-help">
              Lets LevlCast hear when your mic goes quiet and see which scene is on. It all stays on this computer.
            </p>
            {obsForm(
              obsCfg.enabled && (
                <button type="button" className="ld-link" onClick={() => updateObs({ enabled: false })}>
                  Disconnect
                </button>
              ),
              true
            )}

            {obsStatus === "connected" && micInputs.length > 0 && (
              <label className="ld-field">
                <span>Your mic</span>
                <select
                  value={obsCfg.mic ?? ""}
                  onChange={(e) => {
                    obsRef.current?.setMic(e.target.value);
                    updateObs({ mic: e.target.value });
                  }}
                >
                  {micInputs.map((i) => (
                    <option key={i.name} value={i.name}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="ld-field">
              <span>Tell me I&apos;m quiet after</span>
              <select value={obsCfg.quietSeconds} onChange={(e) => updateObs({ quietSeconds: Number(e.target.value) })}>
                {QUIET_CHOICES.map(([s, label]) => (
                  <option key={s} value={s}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
