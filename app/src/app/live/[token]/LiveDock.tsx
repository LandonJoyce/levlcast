"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CueEngine, clock, nowCue, type Cue, type LiveSignals } from "@/lib/live/cues";
import { ObsLink, type ObsInput, type ObsStatus } from "@/lib/live/obs";
import { TwitchChat } from "@/lib/live/chat";

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
 * Nothing here is ever shown on stream; the dock is part of OBS's window.
 */

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
  session: Session | null;
  serverTime: string;
}

interface ObsConfig {
  enabled: boolean;
  port: number;
  password: string;
  mic: string | null;
  quietSeconds: number;
}

const OBS_KEY = "lc-live-obs-v1";
const DEFAULT_OBS: ObsConfig = { enabled: false, port: 4455, password: "", mic: null, quietSeconds: 45 };

/** Louder than this is talking; quieter than QUIET_DB is quiet. In between keeps the last state. */
const TALK_DB = -38;
const QUIET_DB = -45;

/** Audio inputs worth offering as "your mic". */
const AUDIO_KIND = /(input|output)_capture|audio/i;

function loadObs(): ObsConfig {
  try {
    const raw = localStorage.getItem(OBS_KEY);
    if (raw) return { ...DEFAULT_OBS, ...JSON.parse(raw) };
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
  const [now, setNow] = useState(() => Date.now());

  // Chat
  const [chatStatus, setChatStatus] = useState<"connecting" | "connected" | "error">("connecting");
  const chatters = useRef(new Set<string>());
  const chatTimes = useRef<number[]>([]);
  const lastChatAt = useRef<number | null>(null);
  const [chatterCount, setChatterCount] = useState(0);

  // OBS
  const [obsCfg, setObsCfg] = useState<ObsConfig>(DEFAULT_OBS);
  const [obsStatus, setObsStatus] = useState<ObsStatus>("off");
  const [obsDetail, setObsDetail] = useState<string | null>(null);
  const [inputs, setInputs] = useState<ObsInput[]>([]);
  const [scene, setScene] = useState<string | null>(null);
  const sceneSince = useRef<number | null>(null);
  const lastTalkAt = useRef<number | null>(null);
  const talkingRef = useRef(false);
  const [talking, setTalking] = useState(false);
  const [levelDb, setLevelDb] = useState(-Infinity);
  const levelShownAt = useRef(0);
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

  /** False once a free plan's coaching window is over; chat events read it. */
  const coachingRef = useRef(true);
  const pushCue = useCallback((c: Cue) => {
    if (coachingRef.current) setFeed((f) => [c, ...f].slice(0, 25));
  }, []);

  const updateObs = useCallback((patch: Partial<ObsConfig>) => {
    setObsCfg((c) => {
      const next = { ...c, ...patch };
      saveObs(next);
      return next;
    });
  }, []);

  // Saved OBS settings, once on load.
  useEffect(() => {
    const cfg = loadObs();
    setObsCfg(cfg);
    setDraft({ password: cfg.password, port: String(cfg.port) });
  }, []);

  useEffect(() => {
    if (engine.current) engine.current.tuning = { quietSeconds: obsCfg.quietSeconds, speed };
  }, [obsCfg.quietSeconds, speed]);

  // The server: viewers, followers, the stream itself. About once a minute.
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const res = await fetch(`/api/live/${token}`, { cache: "no-store" });
        const json = await res.json();
        if (!alive) return;
        if (res.ok) {
          setState(json as LiveState);
          setPollError(null);
        } else {
          setPollError(json.error ?? "Couldn't reach LevlCast. Trying again.");
        }
      } catch {
        if (alive) setPollError("Can't reach LevlCast. Check your internet. Trying again.");
      } finally {
        if (alive) timer = setTimeout(load, pollSeconds * 1000);
      }
    };
    void load();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [token, pollSeconds]);

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
          if (!chatters.current.has(m.user)) {
            chatters.current.add(m.user);
            setChatterCount(chatters.current.size);
          }
          if (m.firstTime && engine.current) pushCue(engine.current.newChatter(m.name, Date.now()));
        },
        raid: (from, viewers) => {
          if (engine.current) pushCue(engine.current.raid(from, viewers, Date.now()));
        },
      },
      chatUrl || undefined
    );
    chat.connect();
    return () => chat.close();
  }, [channel, chatUrl, pushCue]);

  // OBS on this computer: the mic and the scene. Only when it's been set up.
  useEffect(() => {
    if (!obsCfg.enabled) {
      setObsStatus("off");
      return;
    }
    const link = new ObsLink(
      { port: obsCfg.port, password: obsCfg.password, mic: loadObs().mic },
      {
        status: (s, detail) => {
          setObsStatus(s);
          setObsDetail(detail ?? null);
          if (s === "connected") lastTalkAt.current = Date.now();
        },
        level: (db) => {
          const t = Date.now();
          if (db > TALK_DB) {
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
  }, [obsCfg.enabled, obsCfg.port, obsCfg.password, attempt, updateObs]);

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

  const signals: LiveSignals = useMemo(
    () => ({
      now,
      live,
      liveSince,
      viewers: viewerPoints,
      lastChatAt: lastChatAt.current,
      obs: obsStatus === "connected" ? { lastTalkAt: lastTalkAt.current, scene, sceneSince: sceneSince.current } : null,
    }),
    [now, live, liveSince, viewerPoints, obsStatus, scene]
  );

  useEffect(() => {
    if (!engine.current || !coaching) return;
    const fired = engine.current.tick(signals);
    if (fired.length) setFeed((f) => [...fired.reverse(), ...f].slice(0, 25));
  }, [signals, coaching]);

  const current = engine.current && coaching ? engine.current.current(signals) : null;
  const card = coaching ? nowCue(current, feed, now, speed) : null;

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

  const connect = () => {
    const port = Number(draft.port) || 4455;
    updateObs({ enabled: true, port, password: draft.password });
    setAttempt((n) => n + 1);
  };

  return (
    <div className="ld">
      <header className="ld-top">
        <span className="ld-state" data-live={live ? "1" : "0"}>
          <i aria-hidden="true" />
          {live ? <>Live {liveSince !== null ? clock(now - liveSince) : ""}</> : "Offline"}
        </span>
        <span className="ld-who">{displayName}</span>
        <button type="button" className="ld-obs" data-state={obsStatus} onClick={() => setSheetOpen(true)}>
          {obsLabel}
        </button>
      </header>

      {!state && !pollError && <p className="ld-wait">Checking your stream…</p>}

      {state && live && session && (
        <>
          {coaching ? (
            <section className="ld-now" data-tone={card?.tone ?? "calm"}>
              <p className="ld-k">Now</p>
              <p className="ld-now-t">{card ? card.title : "Looking good"}</p>
              <p className="ld-now-a">{card ? card.action : talking ? "Keep it up." : "Keep talking to chat."}</p>
              {!pro && Number.isFinite(coachLeftMs) && (
                <p className="ld-plan">
                  Free plan: {Math.max(1, Math.ceil((coachLeftMs * speed) / 60_000))} min of coaching left this stream
                </p>
              )}
            </section>
          ) : (
            <section className="ld-now ld-now-off" data-tone="calm">
              <p className="ld-k">Coaching</p>
              <p className="ld-now-t">Off for the rest of this stream</p>
              <p className="ld-now-a">
                Free covers the first {freeMinutes} minutes of each stream. Pro coaches all of it.{" "}
                <a href="/#pricing" target="_blank" rel="noopener noreferrer">
                  See Pro
                </a>
              </p>
            </section>
          )}

          <div className="ld-stats">
            <div>
              <b>{session.viewers ?? "-"}</b>
              <span>Viewers</span>
            </div>
            <div>
              <b>{session.peak}</b>
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

          <Spark samples={session.samples} />

          <div className="ld-lines">
            {obsStatus === "connected" ? (
              <p>
                <span className="ld-l">Mic</span>
                <span className="ld-meter" aria-hidden="true">
                  <i style={{ width: `${meter}%` }} data-talking={talking ? "1" : "0"} />
                </span>
                <span className="ld-v">{talking ? "Talking" : `Quiet ${clock(quietFor * speed)}`}</span>
              </p>
            ) : (
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

          {feed.length > 0 && (
            <section className="ld-feed">
              <p className="ld-k">Earlier</p>
              <ul>
                {feed.slice(0, 8).map((c) => (
                  <li key={c.id} data-tone={c.tone}>
                    <span className="ld-at">{liveSince !== null ? clock(Math.max(0, c.at - liveSince)) : ""}</span>
                    <span>{c.title}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {state && !live && (
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
            </div>
          ) : (
            <p className="ld-off-s">Your first stream with this open shows up here.</p>
          )}
          {obsStatus !== "connected" && (
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

      <footer className="ld-foot">Only you can see this. It&apos;s part of OBS, not your stream.</footer>

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
            <ol className="ld-steps">
              <li>
                In OBS, open <b>Tools</b>, then <b>WebSocket Server Settings</b>, and tick <b>Enable WebSocket server</b>.
              </li>
              <li>
                Click <b>Show Connect Info</b> and copy the <b>Server Password</b>.
              </li>
              <li>Paste it here and press Connect.</li>
            </ol>
            <label className="ld-field">
              <span>Password</span>
              <input
                type="password"
                value={draft.password}
                onChange={(e) => setDraft((d) => ({ ...d, password: e.target.value }))}
                autoComplete="off"
              />
            </label>
            <label className="ld-field ld-field-small">
              <span>Port</span>
              <input inputMode="numeric" value={draft.port} onChange={(e) => setDraft((d) => ({ ...d, port: e.target.value.replace(/\D/g, "") }))} />
            </label>
            <div className="ld-row">
              <button type="button" className="ld-btn" onClick={connect}>
                {obsCfg.enabled ? "Reconnect" : "Connect"}
              </button>
              {obsCfg.enabled && (
                <button type="button" className="ld-link" onClick={() => updateObs({ enabled: false })}>
                  Disconnect
                </button>
              )}
            </div>
            <p className="ld-status" data-state={obsStatus}>
              {obsStatus === "connected" ? "Connected." : obsStatus === "connecting" ? "Connecting…" : obsDetail ?? "Not connected."}
            </p>

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
                {[30, 45, 60, 90].map((s) => (
                  <option key={s} value={s}>
                    {s} seconds
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
