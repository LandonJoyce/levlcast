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
 * Pick a varied per-row highlight from the coach report so the feed
 * reads like a multi-axis analytics product, not a one-axis warning.
 *
 * Deliberately does NOT use `viewer_retention_risk` — almost every
 * lower-score report gets flagged "high" by the AI, so it dominated
 * the feed and told the reader nothing specific. We lead with concrete
 * observable signals (peaks, cold open quality, energy trend, dead air,
 * closing strength) and use a deterministic seed when multiple
 * candidates qualify so adjacent rows pick different angles.
 */
function pickHighlight(row: FeedRow, idx: number): Highlight | null {
  const report = row.coach_report;
  if (!report) return null;

  const score = report.overall_score ?? null;
  const peaks = Array.isArray(row.peak_data) ? row.peak_data.length : 0;
  const dur = row.duration_seconds ?? 0;
  const deadSecs = deadAirSeconds(report);
  const deadPct = report.dead_air_pct ?? (dur > 0 ? Math.round((deadSecs / dur) * 100) : 0);

  // Gather every applicable highlight, then pick one. Ordering inside
  // each tone is by significance, so the strongest signal wins first.
  const candidates: Highlight[] = [];

  // POSITIVES
  if (peaks >= 4) candidates.push({ text: `${peaks} viral moments`, tone: "positive" });
  else if (peaks >= 3) candidates.push({ text: `${peaks} viral moments`, tone: "positive" });
  if (score !== null && score >= 70 && report.energy_trend === "building") {
    candidates.push({ text: "energy building", tone: "positive" });
  }
  if (score !== null && score >= 65 && report.cold_open?.score === "strong") {
    candidates.push({ text: "strong opener", tone: "positive" });
  }
  if (score !== null && score >= 65 && report.closing?.score === "strong") {
    candidates.push({ text: "built to finish", tone: "positive" });
  }
  if (score !== null && score >= 70 && report.energy_trend === "consistent") {
    candidates.push({ text: "steady energy", tone: "positive" });
  }

  // NEGATIVES — concrete and specific
  if (deadPct >= 20 && deadSecs >= 180) {
    candidates.push({ text: `${fmtSeconds(deadSecs)} dead air`, tone: "negative" });
  }
  if (report.cold_open?.score === "weak") {
    candidates.push({ text: "weak cold open", tone: "negative" });
  }
  if (report.energy_trend === "declining") {
    candidates.push({ text: "energy fading", tone: "negative" });
  }
  if (report.closing?.score === "weak") {
    candidates.push({ text: "stream fizzled", tone: "negative" });
  }
  if (report.energy_trend === "volatile") {
    candidates.push({ text: "energy swings", tone: "negative" });
  }
  if (deadSecs >= 60 && deadPct < 20) {
    // Smaller dead air gap — still worth surfacing
    candidates.push({ text: `${fmtSeconds(deadSecs)} dead air`, tone: "negative" });
  }
  if (peaks === 0 && score !== null && score < 55) {
    candidates.push({ text: "no clear peaks", tone: "negative" });
  }

  // NEUTRAL fallback
  if (peaks >= 1 && peaks <= 2) {
    candidates.push({ text: `${peaks} clip moment${peaks === 1 ? "" : "s"}`, tone: "neutral" });
  }

  if (candidates.length === 0) return null;
  // If multiple candidates qualify, rotate by row index so adjacent
  // rows show different angles instead of the same first-match every
  // time. This is what makes the feed visually varied.
  return candidates[idx % candidates.length];
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
          const highlight = pickHighlight(r, i);
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
