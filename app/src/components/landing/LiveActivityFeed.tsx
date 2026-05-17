import { createAdminClient } from "@/lib/supabase/server";

/**
 * Real activity feed — replaces the fabricated streamer marquee with
 * anonymized data pulled from actual analyzed VODs.
 *
 * Privacy: NO twitch_login, NO stream title, NO user_id is rendered.
 * We expose only: time-ago, duration, score, dead-air time, and
 * streamer-type category. None of this can identify a specific streamer.
 *
 * Re-fetched per request — Next.js caches at the route level. If we
 * want sub-minute freshness, set `export const revalidate = 60` on
 * the parent page.
 */

interface FeedRow {
  duration_seconds: number | null;
  coach_report: {
    overall_score?: number;
    streamer_type?: string;
    energy_trend?: "building" | "declining" | "consistent" | "volatile";
    viewer_retention_risk?: "low" | "medium" | "high";
    cold_open?: { score?: "strong" | "average" | "weak" };
    closing?: { score?: "strong" | "average" | "weak" };
    strengths?: string[];
    improvements?: string[];
    dead_zones?: Array<{ time: string; duration: number }>;
    dead_air_seconds?: number;
    dead_air_pct?: number;
    score_breakdown?: { energy?: number; engagement?: number; consistency?: number; content?: number };
  } | null;
  peak_data: unknown;
  game_category: string | null;
}

interface Highlight {
  text: string;
  /** Positive (green), neutral/info (white-ish), or negative (amber/red) */
  tone: "positive" | "neutral" | "negative";
}

function deadAirSeconds(report: FeedRow["coach_report"]): number {
  if (!report) return 0;
  if (typeof report.dead_air_seconds === "number") return report.dead_air_seconds;
  // Fall back for old reports that don't have the total field — sum the
  // worst-5 gaps as a floor. Always an underestimate, never inflated.
  return report.dead_zones?.reduce((acc, g) => acc + (g.duration || 0), 0) ?? 0;
}

function fmtSeconds(secs: number): string {
  if (secs < 60) return `${secs}s`;
  return `${Math.round(secs / 60)}m`;
}

/**
 * Pick the single most headline-worthy signal for this row. Priority is
 * ordered so the feed reads as varied — high-scoring streams lead with
 * a positive, struggling streams lead with the most actionable problem.
 *
 * The whole reason this function exists: when every row says "Xm dead
 * air" the feed makes it look like dead air is the only thing we
 * measure. Real coach reports surface energy trend, retention risk,
 * cold-open quality, viral peaks, etc. Different rows should highlight
 * different angles so the feed feels like a real analytics product.
 */
function pickHighlight(row: FeedRow): Highlight | null {
  const report = row.coach_report;
  if (!report) return null;

  const score = report.overall_score ?? null;
  const peaks = Array.isArray(row.peak_data) ? row.peak_data.length : 0;
  const dur = row.duration_seconds ?? 0;
  const deadSecs = deadAirSeconds(report);
  const deadPct = report.dead_air_pct ?? (dur > 0 ? Math.round((deadSecs / dur) * 100) : 0);

  // ── Positives first when the stream is genuinely strong ─────────────
  if (score !== null && score >= 75) {
    if (peaks >= 3) return { text: `${peaks} viral moments`, tone: "positive" };
    if (report.energy_trend === "building") return { text: "energy building", tone: "positive" };
    if (report.cold_open?.score === "strong") return { text: "strong opener", tone: "positive" };
    if (report.closing?.score === "strong") return { text: "built to finish", tone: "positive" };
    if (report.viewer_retention_risk === "low") return { text: "sticky stream", tone: "positive" };
  }

  // ── Standout signals for any score range ────────────────────────────
  if (peaks >= 4) return { text: `${peaks} viral moments`, tone: "positive" };
  if (report.energy_trend === "building" && score !== null && score >= 60) {
    return { text: "energy building", tone: "positive" };
  }

  // ── Real problems — pick the biggest single issue ───────────────────
  if (report.viewer_retention_risk === "high") {
    return { text: "high churn risk", tone: "negative" };
  }
  if (deadPct >= 25 && deadSecs >= 60) {
    return { text: `${fmtSeconds(deadSecs)} dead air`, tone: "negative" };
  }
  if (report.cold_open?.score === "weak") {
    return { text: "weak cold open", tone: "negative" };
  }
  if (report.energy_trend === "declining") {
    return { text: "energy fading", tone: "negative" };
  }
  if (report.closing?.score === "weak") {
    return { text: "stream fizzled", tone: "negative" };
  }
  if (deadSecs >= 30) {
    return { text: `${fmtSeconds(deadSecs)} dead air`, tone: "negative" };
  }

  // ── Neutral fallbacks ──────────────────────────────────────────────
  if (peaks >= 2) return { text: `${peaks} clip moments`, tone: "neutral" };
  if (report.energy_trend === "consistent" && score !== null && score >= 60) {
    return { text: "steady energy", tone: "positive" };
  }
  return null;
}

function highlightColor(tone: Highlight["tone"]): string {
  switch (tone) {
    case "positive": return "rgba(163,230,53,0.85)";
    case "negative": return "rgba(255,176,140,0.85)";
    default:         return "rgba(255,255,255,0.55)";
  }
}

const TYPE_LABEL: Record<string, string> = {
  gaming: "GAMING",
  just_chatting: "JUST CHATTING",
  irl: "IRL",
  variety: "VARIETY",
  educational: "EDUCATIONAL",
};

function fmtDuration(secs: number | null): string {
  if (!secs) return "?";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function scoreColor(n: number): string {
  if (n >= 75) return "#A3E635";
  if (n >= 50) return "#F59E0B";
  return "#F87171";
}

async function fetchRecentAnalyses(): Promise<FeedRow[]> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("vods")
      .select("duration_seconds, coach_report, peak_data, game_category")
      .eq("status", "ready")
      .not("analyzed_at", "is", null)
      .not("coach_report", "is", null)
      .order("analyzed_at", { ascending: false })
      .limit(6);
    return (data as FeedRow[] | null) ?? [];
  } catch {
    return [];
  }
}

export default async function LiveActivityFeed() {
  const rows = await fetchRecentAnalyses();

  if (rows.length === 0) return null;

  return (
    <div className="ll-feed">
      <div className="ll-feed-head">
        <span className="ll-feed-eyebrow">Recent Reports</span>
        <span className="ll-feed-meta">Last {rows.length} Streams</span>
      </div>
      <div className="ll-feed-scan" aria-hidden="true" />

      <div className="ll-feed-list">
        {rows.map((r, i) => {
          const score = r.coach_report?.overall_score ?? null;
          const highlight = pickHighlight(r);
          const type = r.coach_report?.streamer_type ?? "gaming";
          const typeLabel = TYPE_LABEL[type] ?? type.toUpperCase();
          return (
            <div key={i} className="ll-feed-row ll-feed-row-anim" style={{ animationDelay: `${i * 90}ms` }}>
              <span className="ll-feed-dur">{fmtDuration(r.duration_seconds)}</span>
              <span className="ll-feed-cat">{typeLabel}</span>
              {score !== null ? (
                <span
                  className="ll-feed-score"
                  style={{ color: scoreColor(score) }}
                >
                  {score}
                  <span className="ll-feed-score-out">/100</span>
                </span>
              ) : (
                <span />
              )}
              {highlight ? (
                <span className="ll-feed-dz" style={{ color: highlightColor(highlight.tone) }}>
                  {highlight.text}
                </span>
              ) : (
                <span />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
