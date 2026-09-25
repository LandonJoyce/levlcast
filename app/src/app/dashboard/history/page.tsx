import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { buildMatchHistory, summarizeMatches, type MatchVodRow } from "@/lib/match-history";
import { getLeagueResults } from "@/lib/league";
import { RankBadge } from "@/components/dashboard/rank-badge";
import { MatchHistoryList, MatchSummaryStrip } from "@/components/dashboard/match-history";

export const metadata = { title: "Match history" };

export default async function MatchHistoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [{ data: profile }, { data: vods }, leagueResults] = await Promise.all([
    supabase.from("profiles").select("rank_points").eq("id", user.id).single(),
    // Every ready stream, not a page of them: the placement and any
    // backfilled deltas are worked out from the whole chain.
    supabase
      .from("vods")
      .select("id, title, analyzed_at, stream_date, created_at, duration_seconds, rank_delta, rank_points_after")
      .eq("user_id", user.id)
      .eq("status", "ready"),
    getLeagueResults(createAdminClient(), user.id, { onlyPaid: true }).catch(() => []),
  ]);

  const matches = buildMatchHistory((vods ?? []) as MatchVodRow[], leagueResults);
  const summary = summarizeMatches(matches);

  return (
    <>
      <div className="page-head">
        <span className="page-eyebrow">Ranked</span>
        <h1 className="page-title">Match history</h1>
        <p className="page-sub">
          Every analyzed stream is a ranked game. Beat your recent form and it&apos;s a win.
        </p>
      </div>

      {matches.length === 0 ? (
        <div className="card card-pad" style={{ textAlign: "center", padding: "48px 24px" }}>
          <p style={{ color: "var(--ink-2)", fontSize: 14, margin: "0 0 18px" }}>
            No ranked streams yet. Your first analysis is your placement game.
          </p>
          <Link href="/dashboard/vods" className="btn btn-blue">Pick a stream</Link>
        </div>
      ) : (
        <>
          <div className="card card-pad">
            <div className="mh-hero">
              <RankBadge points={(profile?.rank_points as number | null) ?? null} size="lg" />
              {summary.games > 0 ? (
                <MatchSummaryStrip summary={summary} />
              ) : (
                <p style={{ margin: 0, color: "var(--ink-2)", fontSize: 14 }}>
                  Placement done. Your next analyzed stream is your first ranked game.
                </p>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h3>All games</h3>
              <div className="right">
                <span className="label-mono">{matches.length} total</span>
              </div>
            </div>
            <MatchHistoryList matches={matches} />
          </div>
        </>
      )}
    </>
  );
}
