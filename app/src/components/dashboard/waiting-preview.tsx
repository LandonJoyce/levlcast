/**
 * The free report on a stream's opening, on the stream's page while its
 * full report is made (lib/waiting-preview.ts). Most new streamers signed
 * up from this exact report, so after joining they land on their own
 * stream with something of theirs to read, not only a progress bar.
 *
 * It's the free report's content in the dashboard's style, minus the
 * sign-up pitch: the fix, what's working, what's costing viewers, and the
 * moments worth clipping.
 */

import { Play } from "lucide-react";
import { WatchMoment } from "@/components/moment/watch-moment";
import { fmtDuration, ReportItem } from "@/components/preview/preview-report";
import type { WaitingPreviewState } from "@/lib/waiting-preview";

function clock(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

export function WaitingPreview({ state }: { state: WaitingPreviewState }) {
  if (state.kind === "running") {
    return (
      <section className="wp" aria-live="polite">
        <p className="hm-k">While you wait</p>
        <p className="wp-wait">
          <span className="ob-dot" aria-hidden="true" />
          Your free report on the first 12 minutes is coming. It usually takes a minute or two.
        </p>
      </section>
    );
  }

  const p = state.preview;
  const r = p.coach_report;
  if (!r) return null;

  const analyzed = p.analyzed_seconds ?? 720;
  const total = p.duration_seconds ?? 0;
  const partial = total > analyzed;
  const score = typeof r.overall_score === "number" ? r.overall_score : null;
  const strengths = (r.strengths ?? []).slice(0, 3);
  const improvements = (r.improvements ?? []).slice(0, 3);
  const peaks = (p.peak_data ?? []).slice(0, 3);

  return (
    <section className="wp" aria-labelledby="wp-title">
      <div className="wp-head">
        <div>
          <p className="hm-k">While you wait</p>
          <h2 id="wp-title" className="wp-title">
            Your free report on the first {Math.round(analyzed / 60)} minutes
          </h2>
        </div>
        {score !== null && (
          <p className="wp-score">
            <span>{score}</span>
            {partial ? "Opening score" : "Out of 100"}
          </p>
        )}
      </div>
      {r.stream_story && <p className="wp-story">{r.stream_story}</p>}

      {r.recommendation && (
        <div className="wp-block">
          <p className="hm-k">Fix this first</p>
          <p className="hm-fix">{r.recommendation}</p>
        </div>
      )}

      {(strengths.length > 0 || improvements.length > 0) && (
        <div className="wp-cols">
          {strengths.length > 0 && (
            <div>
              <p className="hm-k">Working</p>
              <ul className="wp-list" data-tone="good">
                {strengths.map((s, i) => (
                  <ReportItem key={i} text={s} />
                ))}
              </ul>
            </div>
          )}
          {improvements.length > 0 && (
            <div>
              <p className="hm-k">Costing you viewers</p>
              <ul className="wp-list" data-tone="bad">
                {improvements.map((s, i) => (
                  <ReportItem key={i} text={s} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {peaks.length > 0 && (
        <div className="wp-block">
          <p className="hm-k">Clip these</p>
          <ul className="sp-moments">
            {peaks.map((pk, i) => (
              <li key={i} className="sp-moment">
                <WatchMoment vodId={p.twitch_vod_id} seconds={pk.start ?? 0} label={pk.title} className="sp-moment-time">
                  <Play size={9} fill="currentColor" aria-hidden="true" />
                  {clock(pk.start ?? 0)}
                </WatchMoment>
                <div>
                  <p className="sp-moment-title">{pk.title}</p>
                  {pk.hook && <p className="sp-moment-hook">{pk.hook}</p>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="wp-foot">
        {partial
          ? `The full report goes through all ${fmtDuration(total)}, so some of this may change.`
          : "The full report replaces this when it's in."}
      </p>
    </section>
  );
}
