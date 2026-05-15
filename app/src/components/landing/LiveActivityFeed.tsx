import { createAdminClient } from "@/lib/supabase/server";

/**
 * Real activity feed — replaces the fabricated streamer marquee with
 * anonymized data pulled from actual analyzed VODs.
 *
 * Privacy: NO twitch_login, NO stream title, NO user_id is rendered.
 * We expose only: time-ago, duration, score, dead-zone count, and
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
  } | null;
  game_category: string | null;
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
          const deadZones = r.coach_report?.dead_zones?.length ?? 0;
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
              {deadZones > 0 ? (
                <span className="ll-feed-dz">
                  {deadZones} dead {deadZones === 1 ? "zone" : "zones"}
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
