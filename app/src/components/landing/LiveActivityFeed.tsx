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
    dead_zones?: Array<{ time: string; duration: number }>;
    dead_air_seconds?: number;
    dead_air_pct?: number;
  } | null;
  game_category: string | null;
}

/**
 * Build the dead-air label for a row. Prefer the total `dead_air_seconds`
 * stored on newer reports — older reports only have the worst-5-gaps array,
 * which gave every long stream the same "5 dead zones" string. For old
 * reports we sum the worst-5 durations as a floor (the real total is at
 * least this much, so it's never misleading high).
 */
function deadAirLabel(report: FeedRow["coach_report"]): string | null {
  if (!report) return null;

  let seconds = report.dead_air_seconds;
  if (seconds === undefined || seconds === null) {
    const sum = report.dead_zones?.reduce((acc, g) => acc + (g.duration || 0), 0);
    seconds = sum && sum > 0 ? sum : undefined;
  }
  if (!seconds || seconds < 30) return null;

  if (seconds < 60) return `${seconds}s dead air`;
  const m = Math.round(seconds / 60);
  return `${m}m dead air`;
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
      .select("duration_seconds, coach_report, game_category")
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
          const dzLabel = deadAirLabel(r.coach_report);
          const type = r.coach_report?.streamer_type ?? "gaming";
          const typeLabel = TYPE_LABEL[type] ?? type.toUpperCase();
          return (
            <div key={i} className="ll-feed-row">
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
              {dzLabel ? (
                <span className="ll-feed-dz">{dzLabel}</span>
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
