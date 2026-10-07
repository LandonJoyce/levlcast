/**
 * Renders a public preview report.
 *
 * Shared by the live /analyze flow and the shareable /analyze/<vodId>
 * permalink so a visitor and someone opening a shared link see exactly the
 * same thing. Pure presentation: no fetching, no state.
 *
 * The conversion argument is structural rather than nagging: show real
 * coaching in full, then show the shape of what a full report contains and
 * where it stops. The reader should finish this page knowing the tool
 * works and knowing precisely what they are missing.
 *
 * Styled by analyze/analyze.css on top of home-ranked.css, so it sits in
 * the same `ll-page v3` wrapper as the homepage: sections split by rules,
 * not stacked cards.
 */

import { FREE_COACHED_SECONDS } from "@/lib/free-plan";
import { FullReportButton, StickyFullReport } from "./full-report-button";
import { WatchMoment } from "@/components/moment/watch-moment";

export interface PreviewPayload {
  twitch_vod_id: string;
  status: string;
  failed_reason?: string | null;
  title?: string | null;
  streamer_display_name?: string | null;
  streamer_login?: string | null;
  thumbnail_url?: string | null;
  duration_seconds?: number | null;
  analyzed_seconds?: number | null;
  game_category?: string | null;
  coach_report?: CoachReportLite | null;
  peak_data?: PeakLite[] | null;
}

interface CoachReportLite {
  overall_score?: number;
  stream_story?: string;
  recommendation?: string;
  strengths?: string[];
  improvements?: string[];
  cold_open?: { score?: string; note?: string };
  best_moment?: { time?: string; description?: string };
  energy_trend?: string;
  score_breakdown?: { energy?: number; engagement?: number; consistency?: number; content?: number };
  anti_patterns?: Array<{ time?: string; quote?: string; note?: string }>;
  shareable_win?: { stat?: string; context?: string };
}

interface PeakLite {
  title?: string;
  start?: number;
  category?: string;
  hook?: string;
}

function scoreTone(n: number) {
  if (n >= 75) return "good";
  if (n >= 50) return "warn";
  return "bad";
}

function fmtClock(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

export function fmtDuration(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.round((total % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function PreviewReport({ preview }: { preview: PreviewPayload }) {
  const r = preview.coach_report;
  if (!r) return null;

  const score = typeof r.overall_score === "number" ? r.overall_score : null;
  const analyzed = preview.analyzed_seconds ?? 720;
  const total = preview.duration_seconds ?? 0;
  const partial = total > analyzed;
  const peaks = (preview.peak_data ?? []).slice(0, 3);
  const quotes = (r.anti_patterns ?? []).filter((ap) => ap.quote).slice(0, 2);
  const strengths = (r.strengths ?? []).slice(0, 3);
  const improvements = (r.improvements ?? []).slice(0, 3);
  const streamer = preview.streamer_display_name || preview.streamer_login || "This streamer";

  return (
    <article className="pr">
      {/* What was read, and how much of it */}
      <header className="pr-head">
        {preview.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="pr-thumb" src={preview.thumbnail_url} alt="" width={320} height={180} />
        ) : null}
        <div className="pr-head-main">
          <p className="v3-label">
            {streamer}
            {preview.game_category ? ` · ${preview.game_category}` : ""}
          </p>
          <h1 className="pr-title">{preview.title || "Untitled stream"}</h1>
          <p className="pr-scope">
            {partial
              ? `Scored on the first ${fmtDuration(analyzed)} of a ${fmtDuration(total)} stream. The rest isn't graded here.`
              : `Coached the first ${fmtDuration(analyzed)}.`}
          </p>
        </div>
        {score !== null ? (
          <div className="pr-score" data-tone={scoreTone(score)}>
            <span className="pr-score-v">{score}</span>
            {/* Labelled as an OPENING score, not a stream score. The model
                only reads the first minutes, so presenting this as a verdict
                on a multi-hour stream would be wrong and would insult the
                streamer we are trying to convert. */}
            <span className="pr-score-k">{partial ? "Opening score" : "Out of 100"}</span>
          </div>
        ) : null}
      </header>

      {/* Sign-up where people actually are. The report below is long and
          most readers stop after the fix; the only button used to be at
          the very bottom. */}
      <section className="pr-cta">
        <div>
          <p className="pr-k">{partial ? `That's the first ${fmtDuration(analyzed)}` : "That's the free preview"}</p>
          {/* Only what a free account really gets: on a stream over 2 hours
              that's the first 2 hours, and Pro is the rest. */}
          <p className="pr-cta-line">
            {total > FREE_COACHED_SECONDS
              ? `Sign in with Twitch and we'll coach the first 2 hours free, plus give you a panel in OBS that coaches you while you're live. Pro coaches all ${fmtDuration(total)}.`
              : `Sign in with Twitch and we'll coach ${partial ? `the whole ${fmtDuration(total)}` : "the whole stream"} free, plus give you a panel in OBS that coaches you while you're live.`}
          </p>
        </div>
        <div className="pr-cta-act">
          <FullReportButton vodId={preview.twitch_vod_id} />
          <p className="v3-fine">Free. A report every week, no card.</p>
        </div>
      </section>

      {r.stream_story ? (
        <section className="pr-sec">
          <h2 className="pr-k">Summary</h2>
          <p className="pr-story">{r.stream_story}</p>
        </section>
      ) : null}

      {/* The single most useful thing on the page */}
      {r.recommendation ? (
        <section className="pr-sec">
          <h2 className="pr-k">Fix this first</h2>
          <p className="pr-fix">{r.recommendation}</p>
        </section>
      ) : null}

      {/* Quotes from the stream: the most convincing proof we actually listened */}
      {quotes.length > 0 ? (
        <section className="pr-sec">
          <h2 className="pr-k">Said on stream</h2>
          <ul className="pr-quotes">
            {quotes.map((ap, i) => (
              <li key={i}>
                <p className="pr-quote">
                  &ldquo;{ap.quote}&rdquo;
                  {ap.time ? <span className="pr-at">{ap.time}</span> : null}
                </p>
                {ap.note ? <p className="pr-note">{ap.note}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {strengths.length > 0 ? (
        <section className="pr-sec">
          <h2 className="pr-k">Working</h2>
          <ul className="pr-list" data-tone="good">
            {strengths.map((s, i) => (
              <ReportItem key={i} text={s} />
            ))}
          </ul>
        </section>
      ) : null}

      {improvements.length > 0 ? (
        <section className="pr-sec">
          <h2 className="pr-k">Costing you viewers</h2>
          <ul className="pr-list" data-tone="bad">
            {improvements.map((s, i) => (
              <ReportItem key={i} text={s} />
            ))}
          </ul>
        </section>
      ) : null}

      {/* Clippable moments, the thing streamers actually want */}
      {peaks.length > 0 ? (
        <section className="pr-sec">
          <h2 className="pr-k">Clip these</h2>
          <ol className="pr-clips">
            {peaks.map((p, i) => (
              <li key={i}>
                <WatchMoment vodId={preview.twitch_vod_id} seconds={p.start ?? 0} label={p.title} className="pr-clip-at">
                  {fmtClock(p.start ?? 0)}
                </WatchMoment>
                <div>
                  <p className="pr-clip-t">{p.title}</p>
                  {p.hook ? <p className="pr-note">{p.hook}</p> : null}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {/* The honest boundary: what a full report adds */}
      <section className="pr-sec pr-more">
        <p className="pr-k">
          {partial
            ? `That was the first ${fmtDuration(analyzed)} of ${fmtDuration(total)}`
            : `That was the first ${fmtDuration(analyzed)}`}
        </p>
        {/* Coaching first, rank last (2026-10-07): only about 1 in 4 people
            who saw a free report pressed the button while this led with the
            rank ladder, and the DMs that brought them talk about coaching. */}
        <div>
          <h2 className="pr-more-h">Get coached on every stream.</h2>
          <ul className="pr-more-list">
            <li>The first 2 hours coached free, the whole stream on Pro, with the dead air timestamped</li>
            <li>A panel in OBS that coaches you while you&apos;re live, free for the first 30 minutes</li>
            <li>Your best moments cut into clips with captions, ready to post</li>
            <li>A rank that climbs every time you beat your recent form</li>
          </ul>
          <FullReportButton vodId={preview.twitch_vod_id} />
          <p className="v3-fine">Sign in with Twitch. A report every week is free, no card.</p>
        </div>
      </section>
      <StickyFullReport vodId={preview.twitch_vod_id} />
    </article>
  );
}

/**
 * One line of the report. The coach writes these as "**Label**. body" and
 * the markdown was going straight onto the page, asterisks and all, which
 * made the first report a stranger ever reads look broken. The label is
 * bold text at the start of the line, the way the dashboard shows it.
 * The stream page uses it too, for the free report shown while a full
 * one is made.
 */
export function ReportItem({ text }: { text: string }) {
  const bold = text.match(/^\s*\*\*([\s\S]+?)\*\*\s*[—–.:-]?\s*([\s\S]*)$/);
  if (!bold) return <li>{text.replace(/\*\*/g, "")}</li>;
  return (
    <li>
      <b>{bold[1].trim()}.</b> {bold[2].replace(/\*\*/g, "").trim()}
    </li>
  );
}
