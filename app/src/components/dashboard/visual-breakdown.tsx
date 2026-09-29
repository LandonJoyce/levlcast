"use client";

import { Fragment } from "react";
import { Play } from "lucide-react";
import type { CoachReport } from "@/lib/analyze";
import { WatchMoment } from "@/components/moment/watch-moment";
import { clock, resolveStamp, secondsFromStamp, TIME_IN_TEXT } from "@/lib/moment-time";

/*
 * The whole stream, shown more than told. It replaced a column of
 * paragraphs (coach-report.tsx) that read like homework: each note is now
 * a card with its moment one tap away, the opening and ending are drawn
 * from how much you talked, the habits are your own words, and the quiet
 * stretches sit where they happened. The old quiet chart read "2:31:40"
 * as 2 minutes 31, and the trend bars never showed (a percentage height
 * inside a box with none).
 */

const clean = (s: string) => s.replace(/ — /g, ". ").replace(/—/g, " ").trim();

/** "**Label**. body" (or "**Label** — body") into its parts. */
function splitItem(raw: string): { label: string | null; body: string } {
  const m = raw.trim().match(/^\*\*(.+?)\*\*[\s.:,—-]*([\s\S]*)$/);
  if (!m) return { label: null, body: clean(raw.replace(/\*\*/g, "")) };
  return { label: m[1].trim().replace(/[.:]$/, ""), body: clean(m[2]) };
}

const HABIT_NAMES: Record<string, string> = {
  viewer_count_apology: "Apologizing for the viewer count",
  follow_begging: "Asking for follows",
  lurker_shaming: "Calling chat quiet",
  pre_stream_drain: "Stalling at the start",
  self_defeat: "Talking yourself down",
};
const habitName = (type: string) =>
  HABIT_NAMES[type] ?? type.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

const START_WORD: Record<string, string> = { strong: "Strong start", average: "OK start", weak: "Slow start" };
const END_WORD: Record<string, string> = { strong: "Strong finish", average: "OK finish", weak: "Weak finish" };
const TONE: Record<string, "good" | "flat" | "bad"> = { strong: "good", average: "flat", weak: "bad" };

/** Talking, for the opening chart: a minute with this many words or more. */
const TALKING_WPM = 30;

interface Ctx {
  vodId?: string;
  streamDate?: string | null;
  known: number[];
}

/** Text with its times as moments to watch (or just set in mono, when a chip beside it plays them). */
function Playable({ text, ctx, still = false }: { text: string; ctx: Ctx; still?: boolean }) {
  const parts = text.split(new RegExp(`(${TIME_IN_TEXT.source})`, "g"));
  return (
    <>
      {parts.map((p, i) => {
        if (!new RegExp(`^${TIME_IN_TEXT.source}$`).test(p)) return <Fragment key={i}>{p}</Fragment>;
        const seconds = resolveStamp(p, ctx.known);
        return ctx.vodId && !still ? (
          <WatchMoment key={i} vodId={ctx.vodId} seconds={seconds} streamDate={ctx.streamDate} className="vb-time">
            {clock(seconds)}
          </WatchMoment>
        ) : (
          <span key={i} className="vb-time" data-still="yes">
            {clock(seconds)}
          </span>
        );
      })}
    </>
  );
}

/** A chip that plays a moment: "▶ 1:42:10". */
function WatchChip({ seconds, label, ctx }: { seconds: number; label?: string; ctx: Ctx }) {
  if (!ctx.vodId) return <span className="vb-chip vb-chip-still">{clock(seconds)}</span>;
  return (
    <WatchMoment vodId={ctx.vodId} seconds={seconds} label={label} streamDate={ctx.streamDate} className="vb-chip">
      <Play size={10} fill="currentColor" aria-hidden="true" />
      {clock(seconds)}
    </WatchMoment>
  );
}

function firstTime(text: string, known: number[]): number | null {
  const m = text.match(TIME_IN_TEXT);
  return m ? resolveStamp(m[0], known) : null;
}

export function VisualBreakdown({
  report,
  twitchVodId,
  streamDate,
  durationSeconds,
  trajectory,
}: {
  report: CoachReport;
  twitchVodId?: string;
  streamDate?: string | null;
  durationSeconds?: number;
  trajectory?: Array<{ score: number; date: string; current?: boolean }>;
}) {
  const strengths = (report.strengths ?? []).filter(Boolean).map(splitItem);
  const improvements = (report.improvements ?? []).filter(Boolean).map(splitItem);
  const habits = report.anti_patterns ?? [];
  const rewatch = report.rewatch_moments ?? [];
  const deadZones = report.dead_zones ?? [];
  const words = Array.isArray(report.words_by_minute) ? report.words_by_minute : null;
  const duration = durationSeconds ?? (words ? words.length * 60 : 0);

  // The exact times the coach gave, so prose like "at 1:42" plays 1:42:10.
  const known = [
    report.best_moment?.time,
    report.momentum_crash?.time,
    ...rewatch.map((r) => r.time),
    ...habits.map((a) => a.time),
    ...deadZones.map((z) => z.time),
  ]
    .filter((t): t is string => typeof t === "string")
    .map(secondsFromStamp)
    .filter((t) => t >= 3600);
  const ctx: Ctx = { vodId: twitchVodId, streamDate, known };

  return (
    <div className="vb">
      {report.stream_story && (
        <p className="vb-story">
          <Playable text={clean(report.stream_story)} ctx={ctx} />
        </p>
      )}

      {(strengths.length > 0 || improvements.length > 0) && (
        <div className="vb-duo">
          <Cards title="What worked" tone="good" items={strengths} ctx={ctx} />
          <Cards title="What to change" tone="bad" items={improvements} ctx={ctx} />
        </div>
      )}

      {(report.cold_open?.note || report.closing?.note) && (
        <section className="vb-sec">
          <h3 className="vb-k">How it started and ended</h3>
          <div className="vb-duo">
            {report.cold_open?.note && (
              <Ends
                which="start"
                score={report.cold_open.score}
                note={report.cold_open.note}
                words={words}
                startSeconds={Number(report.stream_start_seconds ?? 0)}
                ctx={ctx}
              />
            )}
            {report.closing?.note && (
              <Ends which="end" score={report.closing.score} note={report.closing.note} words={words} startSeconds={0} ctx={ctx} />
            )}
          </div>
        </section>
      )}

      {habits.length > 0 && (
        <section className="vb-sec">
          <h3 className="vb-k">Habits that cost you viewers</h3>
          <div className="vb-quotes">
            {habits.map((h, i) => {
              const seconds = secondsFromStamp(h.time);
              return (
                <figure key={i} className="vb-quote">
                  <figcaption>
                    <span>{habitName(h.type)}</span>
                    <WatchChip seconds={seconds} label={habitName(h.type)} ctx={ctx} />
                  </figcaption>
                  <blockquote>&ldquo;{clean(h.quote)}&rdquo;</blockquote>
                  <p>
                    <Playable text={clean(h.note)} ctx={ctx} />
                  </p>
                </figure>
              );
            })}
          </div>
        </section>
      )}

      {duration > 0 && deadZones.length > 0 && <Quiet zones={deadZones} duration={duration} total={report.dead_air_seconds} ctx={ctx} />}

      {rewatch.length > 0 && (
        <section className="vb-sec">
          <h3 className="vb-k">Worth rewatching</h3>
          <div className="vb-duo">
            {rewatch.map((r, i) => {
              const seconds = secondsFromStamp(r.time);
              return (
                <div key={i} className="vb-card" data-tone={r.kind === "best" ? "good" : "bad"}>
                  <p className="vb-card-k">{r.kind === "best" ? "Do this again" : "Watch this back"}</p>
                  <p className="vb-card-b">
                    <Playable text={clean(r.note)} ctx={ctx} still />
                  </p>
                  <WatchChip seconds={seconds} label={r.kind === "best" ? "Do this again" : "Watch this back"} ctx={ctx} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {trajectory && trajectory.length >= 2 && <Trend points={trajectory} note={report.trend_vs_history} />}

      {report.community_note && (
        <section className="vb-sec">
          <h3 className="vb-k">Who this stream is for</h3>
          <p className="vb-line">{clean(report.community_note)}</p>
        </section>
      )}
    </div>
  );
}

function Cards({
  title,
  tone,
  items,
  ctx,
}: {
  title: string;
  tone: "good" | "bad";
  items: Array<{ label: string | null; body: string }>;
  ctx: Ctx;
}) {
  if (items.length === 0) return null;
  return (
    <section className="vb-sec">
      <h3 className="vb-k">{title}</h3>
      <div className="vb-cards">
        {items.map((it, i) => {
          const at = firstTime(it.body, ctx.known);
          return (
            <div key={i} className="vb-card" data-tone={tone}>
              {it.label && <p className="vb-card-k">{it.label}</p>}
              <p className="vb-card-b">
                <Playable text={it.body} ctx={ctx} still={at !== null} />
              </p>
              {at !== null && <WatchChip seconds={at} label={it.label ?? title} ctx={ctx} />}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * The first or last ten minutes as talking bars, with the coach's call on
 * it. The opening marks the first minute you really talked, which is what
 * "a slow start" means.
 */
function Ends({
  which,
  score,
  note,
  words,
  startSeconds,
  ctx,
}: {
  which: "start" | "end";
  score: string;
  note: string;
  words: number[] | null;
  startSeconds: number;
  ctx: Ctx;
}) {
  const WINDOW = 10;
  let bars: Array<{ minute: number; w: number }> = [];
  let firstTalk: number | null = null;
  if (words && words.length > 0) {
    const from = which === "start" ? Math.min(words.length - 1, Math.floor(startSeconds / 60)) : Math.max(0, words.length - WINDOW);
    bars = words.slice(from, from + WINDOW).map((w, i) => ({ minute: from + i, w }));
    // Only worth marking when they weren't talking from the first minute.
    const talk = which === "start" ? bars.find((b) => b.w >= TALKING_WPM)?.minute ?? null : null;
    firstTalk = talk !== null && talk > from ? talk : null;
  }
  const max = Math.max(60, ...bars.map((b) => b.w));
  const word = (which === "start" ? START_WORD : END_WORD)[score] ?? (which === "start" ? "The start" : "The finish");
  return (
    <div className="vb-card vb-ends" data-tone={TONE[score] ?? "flat"}>
      <p className="vb-card-k">
        {which === "start" ? "First 10 minutes" : "Last 10 minutes"}
        <span className="vb-pill" data-tone={TONE[score] ?? "flat"}>
          {word}
        </span>
      </p>
      {bars.length > 0 && (
        <div className="vb-bars" role="img" aria-label={`How much you talked each minute, ${which === "start" ? "from the start" : "to the end"}`}>
          {bars.map((b) => (
            <span
              key={b.minute}
              className="vb-bar"
              data-first={firstTalk === b.minute ? "yes" : undefined}
              style={{ height: `${Math.max(4, (b.w / max) * 100)}%` }}
              title={`${clock(b.minute * 60)} · ${b.w} words`}
            />
          ))}
        </div>
      )}
      {bars.length > 0 && (
        <div className="vb-bars-axis">
          <span>{clock(bars[0].minute * 60)}</span>
          {firstTalk !== null ? (
            <span className="vb-first">You got talking at {clock(firstTalk * 60)}</span>
          ) : (
            <span />
          )}
          <span>{clock((bars[bars.length - 1].minute + 1) * 60)}</span>
        </div>
      )}
      <p className="vb-card-b">
        <Playable text={clean(note)} ctx={ctx} />
      </p>
      {firstTalk !== null && (
        <WatchChip seconds={firstTalk * 60} label="Where you got talking" ctx={ctx} />
      )}
    </div>
  );
}

/** The stream as a line, the quiet stretches where they happened. Tap one to watch it. */
function Quiet({
  zones,
  duration,
  total,
  ctx,
}: {
  zones: Array<{ time: string; duration: number }>;
  duration: number;
  total?: number;
  ctx: Ctx;
}) {
  const spans = zones
    .map((z) => ({ start: secondsFromStamp(z.time), length: Math.max(0, Number(z.duration) || 0) }))
    .filter((z) => z.start < duration);
  if (spans.length === 0) return null;
  const quietSeconds = typeof total === "number" ? total : spans.reduce((s, z) => s + z.length, 0);
  return (
    <section className="vb-sec">
      <h3 className="vb-k">Where it went quiet</h3>
      <div className="vb-track">
        {spans.map((z, i) => {
          const left = (z.start / duration) * 100;
          const width = Math.max(0.8, Math.min(100 - left, (z.length / duration) * 100));
          const label = `${Math.max(1, Math.round(z.length / 60))} quiet ${Math.round(z.length / 60) === 1 ? "minute" : "minutes"}`;
          const style = { left: `${left}%`, width: `${width}%` };
          return ctx.vodId ? (
            <WatchMoment key={i} vodId={ctx.vodId} seconds={z.start} label={label} streamDate={ctx.streamDate} className="vb-span" style={style}>
              <span className="vb-sr">
                {label} at {clock(z.start)}
              </span>
            </WatchMoment>
          ) : (
            <span key={i} className="vb-span" style={style} />
          );
        })}
      </div>
      <div className="vb-track-axis">
        <span>0:00</span>
        <span>
          {spans.length} quiet {spans.length === 1 ? "stretch" : "stretches"}, {Math.max(1, Math.round(quietSeconds / 60))} minutes
          {ctx.vodId && <span className="vb-hint"> · tap one to watch it</span>}
        </span>
        <span>{clock(duration)}</span>
      </div>
    </section>
  );
}

/** Your recent scores as bars, this stream lit, with the coach's read under it. */
function Trend({
  points,
  note,
}: {
  points: Array<{ score: number; date: string; current?: boolean }>;
  note?: { direction: string; note: string };
}) {
  const scores = points.map((p) => p.score);
  const top = Math.max(...scores);
  const floor = Math.max(0, Math.min(...scores) - 20);
  return (
    <section className="vb-sec">
      <h3 className="vb-k">Your last few streams</h3>
      <div className="vb-trend" role="img" aria-label={`Scores, oldest first: ${points.map((p) => p.score).join(", ")}`}>
        {points.map((p, i) => (
          <div key={i} className="vb-trend-col" data-now={p.current ? "yes" : undefined}>
            <span className="vb-trend-n">{p.score}</span>
            <span className="vb-trend-bar" style={{ height: `${Math.max(6, ((p.score - floor) / Math.max(1, top - floor)) * 100)}%` }} />
          </div>
        ))}
      </div>
      <p className="vb-small">Oldest on the left. This stream is the light bar.</p>
      {note?.note && note.direction !== "first_stream" && <p className="vb-line">{clean(note.note)}</p>}
    </section>
  );
}
