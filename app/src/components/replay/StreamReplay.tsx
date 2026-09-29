"use client";

/**
 * A stream, played back as a sculpture that builds itself. The stage and
 * everything on it are drawn by replay-scene.ts; this component owns the
 * words: the heading, the clock, the caption that rides above the build,
 * the notes pinned to clips and dead air, the scrubber, the chat box, and
 * the result.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { TIER_HEX, type DeltaResult } from "@/lib/rank";
import { durationLabel, replayResult, sceneAnchors, shortClock, type ReplayData, type SceneAnchor } from "./replay-data";
import type { ReplayPhase, ReplayScene } from "./replay-scene";
import { MomentDialog, type Moment } from "@/components/moment/watch-moment";
import "./replay.css";

type Phase = ReplayPhase | "loading" | "nogl";

/**
 * `embedded`: inside a stream's report page, which already carries the
 * title and the rank result. The replay then leads with a small label and
 * ends on its summary line instead of a second result panel.
 */
export default function StreamReplay({
  data,
  example = false,
  embedded = false,
}: {
  data: ReplayData;
  example?: boolean;
  embedded?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const statsRef = useRef<HTMLSpanElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);
  const metaRef = useRef<HTMLDivElement>(null);
  const clockBoxRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const chatRefs = useRef<Array<HTMLParagraphElement | null>>([]);
  const labelRefs = useRef(new Map<string, HTMLElement>());
  const sceneRef = useRef<ReplayScene | null>(null);
  const dragging = useRef(false);
  const keyMinute = useRef(0);
  const [phase, setPhase] = useState<Phase>("loading");
  const [caption, setCaption] = useState(-1);
  // Watching the stream itself, from a pin or from wherever the replay is.
  const [watching, setWatching] = useState<Moment | null>(null);
  const vodId = data.vodId;
  const watch = (seconds: number, label: string) => {
    if (!vodId) return;
    sceneRef.current?.pause();
    setWatching({ vodId, seconds: Math.max(0, Math.floor(seconds)), label, streamDate: data.streamDate });
  };

  const result = useMemo(() => replayResult(data), [data]);
  const anchors = useMemo(() => sceneAnchors(data), [data]);
  const D = data.minutes;
  const deadMinutes = data.deadAir.reduce((s, d) => s + d.minutes, 0);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const held = params.get("t");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const compact = window.matchMedia("(max-width: 760px)").matches;
    import("./replay-scene")
      .then(({ createReplayScene }) => {
        const canvas = canvasRef.current;
        if (cancelled || !canvas) return;
        try {
          sceneRef.current = createReplayScene({
            canvas,
            data,
            hud: {
              clock: clockRef.current,
              stats: statsRef.current,
              caption: captionRef.current,
              labels: labelRefs.current,
              avoid: [metaRef.current, clockBoxRef.current, bottomRef.current],
              scrubHead: headRef.current,
              chatLines: chatRefs.current.filter((el): el is HTMLParagraphElement => !!el),
            },
            reducedMotion,
            compact,
            onPhase: setPhase,
            onCaption: setCaption,
            celebrate: result.tierChange === "up" || result.divisionChange === "up",
            frozenAt: held != null && held !== "" && !Number.isNaN(Number(held)) ? Number(held) : null,
          });
        } catch {
          setPhase("nogl");
        }
      })
      .catch(() => setPhase("nogl"));
    return () => {
      cancelled = true;
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, [data, result]);

  const minuteFrom = (e: ReactPointerEvent) => {
    const r = trackRef.current?.getBoundingClientRect();
    if (!r) return 0;
    return Math.min(D, Math.max(0, ((e.clientX - r.left) / r.width) * D));
  };
  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    keyMinute.current = minuteFrom(e);
    sceneRef.current?.seek(keyMinute.current);
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    keyMinute.current = minuteFrom(e);
    sceneRef.current?.seek(keyMinute.current);
  };
  const onUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    sceneRef.current?.release();
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const step = e.shiftKey ? 15 : 5;
    keyMinute.current = Math.min(D, Math.max(0, keyMinute.current + (e.key === "ArrowRight" ? step : -step)));
    sceneRef.current?.seek(keyMinute.current);
  };
  const onKeyUp = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") sceneRef.current?.release();
  };

  // The scrubber is the sculpture in miniature: a bar a minute.
  const bars = useMemo(() => {
    const dead = (m: number) => data.deadAir.some((s) => m >= s.start && m < s.start + s.minutes);
    const offline = data.offline ?? 0;
    return data.pace
      .map((w, m) => {
        const clip = data.clips.some((c) => Math.floor(c.minute) === m);
        const h = dead(m) ? 2 : 3 + Math.min(1, Math.max(0, (w - 25) / 165)) * 25;
        return { m, h, kind: clip ? "gold" : dead(m) ? "dead" : "plain" };
      })
      .filter((b) => b.m >= offline);
  }, [data]);

  const cap = caption >= 0 ? data.captions[caption] : null;
  const playingNow = phase === "play" || phase === "intro";

  return (
    <section className="rpl-stage" data-phase={phase} data-embedded={embedded ? "1" : "0"} aria-label={`Replay of ${data.title}`}>
      <canvas ref={canvasRef} className="rpl-canvas" aria-hidden />

      <div className="rpl-hud">
        <header className="rpl-top">
          <div className="rpl-meta" ref={metaRef}>
            {embedded ? (
              <p className="rpl-kicker">
                Replay
                <span>
                  {data.clips.length} clips · {deadMinutes} min dead air · drag the bar to scrub
                </span>
              </p>
            ) : (
              <>
                {example && <span className="rpl-tag">Example</span>}
                <h1 className="rpl-title">{data.title}</h1>
                <p className="rpl-sub">
                  {data.when} · {durationLabel(D)} · {data.clips.length} clips · {deadMinutes} min dead air
                </p>
              </>
            )}
          </div>
          <div className="rpl-clock" ref={clockBoxRef} aria-hidden>
            <span className="rpl-clock-t" ref={clockRef}>
              0:00:00
            </span>
            <span className="rpl-clock-s" ref={statsRef}>
              &nbsp;
            </span>
          </div>
        </header>

        <div className="rpl-pins" aria-hidden>
          {anchors.map((a) => (
            <Pin
              key={a.id}
              anchor={a}
              data={data}
              onWatch={vodId ? watch : undefined}
              refFn={(el) => {
                if (el) labelRefs.current.set(a.id, el);
                else labelRefs.current.delete(a.id);
              }}
            />
          ))}
        </div>

        <div className="rpl-now" ref={captionRef} data-on="0" data-tone={cap?.tone ?? "plain"} aria-live="polite">
          <span className="rpl-now-time">{cap ? shortClock(cap.minute) : "0:00"}</span>
          <p className="rpl-now-text" key={caption}>
            {cap ? cap.text : "Replaying your stream."}
          </p>
          {cap && vodId && (
            <button type="button" className="rpl-pin-watch" tabIndex={-1} onClick={() => watch(cap.minute * 60, cap.text)}>
              <PlayIcon /> Watch
            </button>
          )}
        </div>

        <footer className="rpl-bottom" ref={bottomRef}>
          <div className="rpl-controls">
            <button
              type="button"
              className="rpl-play"
              onClick={() => sceneRef.current?.toggle()}
              disabled={phase === "loading" || phase === "nogl"}
              aria-label={playingNow ? "Pause" : "Play"}
            >
              {playingNow ? <PauseIcon /> : <PlayIcon />}
            </button>
            <div className="rpl-scrub">
              <div
                ref={trackRef}
                className="rpl-track"
                role="slider"
                tabIndex={0}
                aria-label="Replay position"
                aria-valuemin={0}
                aria-valuemax={D}
                aria-valuetext="Drag, or use the arrow keys, to jump to any minute"
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
                onKeyDown={onKey}
                onKeyUp={onKeyUp}
              >
                <svg className="rpl-spark" viewBox={`0 0 ${D} 30`} preserveAspectRatio="none" aria-hidden>
                  {bars.map((b) => (
                    <rect key={b.m} className={`rpl-bar rpl-bar-${b.kind}`} x={b.m + 0.18} y={30 - b.h} width={0.64} height={b.h} />
                  ))}
                </svg>
                <div className="rpl-scrub-head" ref={headRef} />
              </div>
              <div className="rpl-scrub-times" aria-hidden>
                <span>0:00</span>
                <span>{shortClock(D / 2)}</span>
                <span>{shortClock(D)}</span>
              </div>
            </div>
            {vodId && (
              <button
                type="button"
                className="rpl-watch"
                onClick={() => {
                  const minute = sceneRef.current?.now() ?? 0;
                  watch(Math.floor(minute) * 60, "Your stream");
                }}
                disabled={phase === "loading" || phase === "nogl"}
                title="Watch the stream from this minute"
              >
                <PlayIcon /> Watch this minute
              </button>
            )}
            {data.illustrativeChat && (
            <div className="rpl-chatbox" aria-hidden>
              <span className="rpl-chatbox-k">Chat</span>
              {[0, 1, 2, 3].map((i) => (
                <p
                  key={i}
                  className="rpl-chatline"
                  ref={(el) => {
                    chatRefs.current[i] = el;
                  }}
                />
              ))}
            </div>
            )}
          </div>
          {phase === "result" &&
            (embedded ? (
              <p className="rpl-endline">{data.summary}</p>
            ) : (
              <Result data={data} result={result} deadMinutes={deadMinutes} />
            ))}
          <button type="button" className="rpl-again" onClick={() => sceneRef.current?.replay()} aria-label="Replay">
            <ReplayIcon />
          </button>
        </footer>

        {phase === "nogl" && <p className="rpl-none">This replay needs WebGL, which this browser has turned off.</p>}
      </div>
      <MomentDialog moment={watching} onClose={() => setWatching(null)} />
    </section>
  );
}

/** A note pinned to a moment in the scene, with a hairline down to it. */
function Pin({
  anchor,
  data,
  refFn,
  onWatch,
}: {
  anchor: SceneAnchor;
  data: ReplayData;
  refFn: (el: HTMLDivElement | null) => void;
  onWatch?: (seconds: number, label: string) => void;
}) {
  if (anchor.kind === "time") {
    return (
      <div ref={refFn} className="rpl-pin rpl-pin-time" data-on="0">
        {shortClock(anchor.minute)}
      </div>
    );
  }
  if (anchor.kind === "row") {
    return (
      <div ref={refFn} className="rpl-pin rpl-pin-row" data-on="0">
        <span className="rpl-pin-k">{anchor.index === 0 ? "You" : "Chat"}</span>
        <span className="rpl-pin-s">{anchor.index === 0 ? "how hard you were talking" : "how much chat talked back"}</span>
      </div>
    );
  }
  let kicker = "";
  let title = "";
  let stat = "";
  let at = 0;
  if (anchor.kind === "clip") {
    const c = data.clips[anchor.index];
    kicker = `${c.best ? "Best moment" : "Clip"} · ${shortClock(c.minute)}`;
    title = c.title;
    at = c.minute * 60;
    stat = `chat hit ${Math.max(...data.chat.slice(Math.floor(c.minute), Math.floor(c.minute) + 3))}/min`;
  } else if (anchor.kind === "dead") {
    const s = data.deadAir[anchor.index];
    kicker = `Dead air · ${shortClock(s.start)}`;
    title = `${s.minutes} minutes, nobody talking`;
    at = s.start * 60;
  } else if (data.crash) {
    kicker = `Momentum crash · ${shortClock(data.crash.start)}`;
    title = `${data.crash.minutes} minutes downhill`;
    at = data.crash.start * 60;
  }
  return (
    <div ref={refFn} className={`rpl-pin rpl-pin-${anchor.kind}`} data-on="0" data-place="ur">
      <span className="rpl-pin-k">{kicker}</span>
      <span className="rpl-pin-t">{title}</span>
      {stat && <span className="rpl-pin-s">{stat}</span>}
      {/* Mouse and touch only: every moment here is also in the report's
          own lists, where the keyboard reaches it. */}
      {onWatch && (
        <button type="button" className="rpl-pin-watch" tabIndex={-1} onClick={() => onWatch(at, title)}>
          <PlayIcon /> Watch
        </button>
      )}
    </div>
  );
}

/**
 * The rank moment. The bar fills from where the streamer was; on a
 * promotion it runs off the end, the emblem changes, and the new rank's
 * bar fills from zero.
 */
function Result({ data, result, deadMinutes }: { data: ReplayData; result: DeltaResult; deadMinutes: number }) {
  const { from, to, delta } = result;
  const crossed = from.label !== to.label;
  const [k, setK] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now() + 350;
    const total = crossed ? 2400 : 1500;
    const tick = (now: number) => {
      const v = Math.min(1, Math.max(0, (now - start) / total));
      setK(v);
      if (v < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [crossed]);

  const ease = (v: number) => 1 - Math.pow(1 - v, 3);
  let shown = from;
  let fill: number;
  let flash = false;
  if (!crossed) {
    fill = from.progress + (to.progress - from.progress) * ease(k);
  } else if (k < 0.5) {
    fill = from.progress + ((delta > 0 ? 100 : 0) - from.progress) * ease(k / 0.5);
  } else {
    shown = to;
    flash = k < 0.62;
    fill = (delta > 0 ? 0 : 100) + (to.progress - (delta > 0 ? 0 : 100)) * ease((k - 0.5) / 0.5);
  }
  const gained = Math.round(delta * ease(k));
  const promoted = result.tierChange === "up";
  const kicker = promoted ? "Promoted" : result.divisionChange === "up" ? "Division up" : delta >= 0 ? "Points gained" : "Points lost";
  const hex = TIER_HEX[shown.tier] ?? "#fffaf7";
  const best = data.clips.find((c) => c.best) ?? data.clips[0];

  return (
    <div className="rpl-res" data-promoted={promoted && k >= 0.5 ? "1" : "0"} data-flash={flash ? "1" : "0"}>
      <div className="rpl-res-emblem" key={shown.tier}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/ranks/${shown.tier.toLowerCase()}.png`} alt={shown.tier} width={384} height={384} />
      </div>
      <div className="rpl-res-rank">
        <span className="rpl-res-k" data-show={crossed ? (k >= 0.5 ? "1" : "0") : "1"}>
          {kicker}
        </span>
        <span className="rpl-res-name">{shown.label}</span>
        <span className="rpl-res-from">{crossed ? (k >= 0.5 ? `from ${from.label}` : `${from.points} points`) : `${from.points} → ${to.points} points`}</span>
      </div>
      <div className="rpl-res-bar">
        <div className="rpl-res-bar-top">
          <span className="rpl-res-delta" data-sign={delta >= 0 ? "up" : "down"}>
            {delta >= 0 ? "+" : "−"}
            {Math.abs(gained)}
          </span>
          <span className="rpl-res-reason">{result.reason}</span>
        </div>
        <div className="rpl-res-track" style={{ ["--tier" as string]: hex }}>
          <div className="rpl-res-fill" style={{ width: `${Math.max(0, Math.min(100, fill))}%` }} />
        </div>
        <p className="rpl-res-summary">{data.summary}</p>
      </div>
      <dl className="rpl-res-stats">
        <div>
          <dt>Score</dt>
          <dd>{data.score}</dd>
        </div>
        {best && (
          <div>
            <dt>Best moment</dt>
            <dd>{shortClock(best.minute)}</dd>
          </div>
        )}
        <div>
          <dt>Dead air</dt>
          <dd>{deadMinutes}m</dd>
        </div>
      </dl>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" />
    </svg>
  );
}
function ReplayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path d="M12 5a7 7 0 1 1-6.6 4.7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4.2 4.5v5.2h5.2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
