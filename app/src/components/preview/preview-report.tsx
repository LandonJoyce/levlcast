/**
 * Renders a public preview report.
 *
 * Shared by the live /analyze flow and the shareable /analyze/<vodId>
 * permalink so a visitor and someone opening a shared link see exactly the
 * same thing. Pure presentation — no fetching, no state.
 *
 * The conversion argument is structural rather than nagging: show real
 * coaching in full, then show the shape of what a full report contains and
 * where it stops. The reader should finish this page knowing the tool
 * works and knowing precisely what they are missing.
 */

import type { CSSProperties } from "react";

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

const INK = "#ECF1FA";
const MUTED = "rgba(236,241,250,0.56)";
const PANEL = "#12151C";
const LINE = "rgba(255,255,255,0.08)";
const GRAD = "linear-gradient(135deg, rgb(255,88,0) 0%, rgb(242,97,121) 100%)";

function scoreColor(n: number) {
  if (n >= 75) return "#A3E635";
  if (n >= 50) return "#F59E0B";
  return "#F87171";
}

function fmtClock(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

function fmtDuration(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.round((total % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const card: CSSProperties = {
  background: PANEL,
  border: `1px solid ${LINE}`,
  borderRadius: 14,
  padding: 20,
};

const label: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: MUTED,
  margin: "0 0 10px",
};

export function PreviewReport({ preview }: { preview: PreviewPayload }) {
  const r = preview.coach_report;
  if (!r) return null;

  const score = typeof r.overall_score === "number" ? r.overall_score : null;
  const analyzed = preview.analyzed_seconds ?? 720;
  const total = preview.duration_seconds ?? 0;
  const peaks = (preview.peak_data ?? []).slice(0, 3);
  const streamer = preview.streamer_display_name || preview.streamer_login || "This streamer";

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Header: what was read, and how much of it */}
      <div style={{ ...card, display: "grid", gap: 14 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
          {preview.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview.thumbnail_url}
              alt=""
              style={{ width: 132, borderRadius: 8, border: `1px solid ${LINE}`, flexShrink: 0 }}
            />
          ) : null}
          <div style={{ minWidth: 200, flex: 1 }}>
            <p style={{ ...label, margin: "0 0 6px" }}>{streamer}</p>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: INK, margin: "0 0 8px", lineHeight: 1.3 }}>
              {preview.title ?? "Untitled stream"}
            </h2>
            <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>
              {total > analyzed
                ? `Scored on the opening ${fmtDuration(analyzed)} of a ${fmtDuration(total)} stream. The rest isn't graded here.`
                : `Coached the first ${fmtDuration(analyzed)}.`}
            </p>
          </div>
          {score !== null ? (
            <div style={{ textAlign: "center", minWidth: 92 }}>
              <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1, color: scoreColor(score) }}>
                {score}
              </div>
              {/* Labelled as an OPENING score, not a stream score. The model
                  only reads the first minutes, so presenting this as a verdict
                  on a multi-hour stream would be wrong and would insult the
                  streamer we are trying to convert. */}
              <div style={{ fontSize: 11, color: MUTED, marginTop: 4, lineHeight: 1.35 }}>
                {total > analyzed ? "opening score" : "out of 100"}
              </div>
            </div>
          ) : null}
        </div>

        {r.stream_story ? (
          <p style={{ fontSize: 14, lineHeight: 1.65, color: "rgba(236,241,250,0.8)", margin: 0 }}>
            {r.stream_story}
          </p>
        ) : null}
      </div>

      {/* The single most useful thing on the page */}
      {r.recommendation ? (
        <div style={{ ...card, borderLeft: "3px solid rgb(255,88,0)" }}>
          <p style={label}>Fix this first</p>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: INK, margin: 0 }}>{r.recommendation}</p>
        </div>
      ) : null}

      {/* Growth-killer quotes: the most convincing proof we actually listened */}
      {r.anti_patterns && r.anti_patterns.length > 0 ? (
        <div style={card}>
          <p style={label}>Caught on your own mic</p>
          <div style={{ display: "grid", gap: 12 }}>
            {r.anti_patterns.slice(0, 2).map((ap, i) => (
              <div key={i}>
                <p style={{ fontSize: 14, color: INK, margin: "0 0 4px", fontStyle: "italic" }}>
                  &ldquo;{ap.quote}&rdquo;
                  {ap.time ? <span style={{ color: MUTED, fontStyle: "normal" }}> &middot; {ap.time}</span> : null}
                </p>
                <p style={{ fontSize: 13, color: MUTED, margin: 0, lineHeight: 1.55 }}>{ap.note}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Strengths and fixes side by side */}
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        {r.strengths && r.strengths.length > 0 ? (
          <div style={card}>
            <p style={label}>Working</p>
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8 }}>
              {r.strengths.slice(0, 3).map((s, i) => (
                <li key={i} style={{ fontSize: 13.5, lineHeight: 1.55, color: "rgba(236,241,250,0.82)" }}>{s}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {r.improvements && r.improvements.length > 0 ? (
          <div style={card}>
            <p style={label}>Costing you viewers</p>
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8 }}>
              {r.improvements.slice(0, 3).map((s, i) => (
                <li key={i} style={{ fontSize: 13.5, lineHeight: 1.55, color: "rgba(236,241,250,0.82)" }}>{s}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {/* Clippable moments — the thing streamers actually want */}
      {peaks.length > 0 ? (
        <div style={card}>
          <p style={label}>Clip these</p>
          <div style={{ display: "grid", gap: 10 }}>
            {peaks.map((p, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "baseline",
                  paddingBottom: i < peaks.length - 1 ? 10 : 0,
                  borderBottom: i < peaks.length - 1 ? `1px solid ${LINE}` : "none",
                }}
              >
                <a
                  href={`https://www.twitch.tv/videos/${preview.twitch_vod_id}?t=${Math.max(0, Math.floor(p.start ?? 0))}s`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 12,
                    fontVariantNumeric: "tabular-nums",
                    color: "rgb(242,97,121)",
                    textDecoration: "none",
                    flexShrink: 0,
                  }}
                >
                  {fmtClock(p.start ?? 0)}
                </a>
                <div>
                  <p style={{ fontSize: 14, color: INK, margin: "0 0 2px", fontWeight: 600 }}>{p.title}</p>
                  {p.hook ? (
                    <p style={{ fontSize: 13, color: MUTED, margin: 0, lineHeight: 1.5 }}>{p.hook}</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* The honest boundary — what a full report adds */}
      <div
        style={{
          ...card,
          background: "linear-gradient(180deg, rgba(255,88,0,0.07) 0%, rgba(18,21,28,1) 100%)",
          borderColor: "rgba(255,88,0,0.25)",
        }}
      >
        <p style={label}>
          {total > analyzed
            ? `That was the opening ${fmtDuration(analyzed)} of ${fmtDuration(total)}`
            : `This was the first ${fmtDuration(analyzed)}`}
        </p>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: INK, margin: "0 0 10px", lineHeight: 1.35 }}>
          A full report reads the whole stream, and every stream after it.
        </h3>
        <ul style={{ margin: "0 0 18px", paddingLeft: 18, display: "grid", gap: 7 }}>
          <li style={{ fontSize: 13.5, color: "rgba(236,241,250,0.78)", lineHeight: 1.5 }}>
            Every minute analyzed, not just the opening, including where your energy actually crashed
          </li>
          <li style={{ fontSize: 13.5, color: "rgba(236,241,250,0.78)", lineHeight: 1.5 }}>
            Dead-air map with timestamps you can scrub straight to
          </li>
          <li style={{ fontSize: 13.5, color: "rgba(236,241,250,0.78)", lineHeight: 1.5 }}>
            Clips cut and captioned for you, ready to post to Shorts or TikTok
          </li>
          <li style={{ fontSize: 13.5, color: "rgba(236,241,250,0.78)", lineHeight: 1.5 }}>
            Stream-over-stream tracking that tells you whether you fixed last week&apos;s problem
          </li>
        </ul>
        <a
          href="/auth/login"
          style={{
            display: "inline-block",
            background: GRAD,
            color: "#fff",
            fontWeight: 700,
            fontSize: 14.5,
            padding: "13px 22px",
            borderRadius: 10,
            textDecoration: "none",
          }}
        >
          Get the full report free
        </a>
        <p style={{ fontSize: 12, color: MUTED, margin: "10px 0 0" }}>
          Connect Twitch, read-only. No credit card.
        </p>
      </div>
    </div>
  );
}
