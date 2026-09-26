import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { buildMatchHistory, summarizeMatches, type MatchVodRow } from "@/lib/match-history";
import { getLeagueResults } from "@/lib/league";
import type { CoachingArcData } from "@/lib/coaching-arc";
import { RankPanel } from "@/components/dashboard/rank-panel";
import { MatchHistoryList, MatchSummaryStrip } from "@/components/dashboard/match-history";
import { CoachingArcCard } from "@/components/dashboard/coaching-arc-card";
import { FollowerBriefCard } from "@/components/dashboard/follower-brief-card";

export const metadata = { title: "Matches" };

/*
 * Every ranked game, and the things that only make sense across many of
 * them: what keeps coming up, what's getting better, and whether the
 * streams are moving the follower count. Those used to sit on the
 * dashboard between the rank and the match list, where they were one
 * more card to scroll past. Here they're next to the games they're about.
 */
export default async function MatchesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const since = new Date();
  since.setDate(since.getDate() - 35);

  const [{ data: profile }, { data: vods }, leagueResults, { data: snapshots }] = await Promise.all([
    supabase.from("profiles").select("rank_points, plan, subscription_expires_at, coaching_arc").eq("id", user.id).single(),
    // Every ready stream, not a page of them: the placement and any
    // backfilled deltas are worked out from the whole chain.
    supabase
      .from("vods")
      .select("id, title, analyzed_at, stream_date, created_at, duration_seconds, rank_delta, rank_points_after")
      .eq("user_id", user.id)
      .eq("status", "ready"),
    getLeagueResults(createAdminClient(), user.id, { onlyPaid: true }).catch(() => []),
    supabase
      .from("follower_snapshots")
      .select("follower_count, snapped_at")
      .eq("user_id", user.id)
      .eq("platform", "twitch")
      .gte("snapped_at", since.toISOString())
      .order("snapped_at", { ascending: true }),
  ]);

  const matches = buildMatchHistory((vods ?? []) as MatchVodRow[], leagueResults);
  const summary = summarizeMatches(matches);

  const isPro =
    profile?.plan === "pro" &&
    !(profile.subscription_expires_at && new Date(profile.subscription_expires_at) < new Date());
  const arc = (profile?.coaching_arc as CoachingArcData | null) ?? null;

  const byDate = [...(vods ?? [])].sort((a, b) =>
    String(b.stream_date ?? b.analyzed_at ?? "").localeCompare(String(a.stream_date ?? a.analyzed_at ?? ""))
  );
  const latestDelta = (byDate[0]?.rank_delta as number | null) ?? null;
  const wins = byDate
    .slice(0, 12)
    .map((v) => v.rank_delta as number | null)
    .filter((d): d is number => d !== null && d > 0 && d < 200);
  const avgWin = wins.length ? Math.round(wins.reduce((a, b) => a + b, 0) / wins.length) : null;
  const streamDates = byDate.map((v) => String(v.stream_date ?? "").slice(0, 10)).filter(Boolean);

  return (
    <>
      <div className="hm-hello">
        <div>
          <h1 className="page-title">Matches</h1>
          <p className="page-sub mh-sub">Every analyzed stream is a ranked game. Beat your recent form and it&apos;s a win.</p>
        </div>
      </div>

      {matches.length === 0 ? (
        <section className="sl-empty">
          <p className="sl-empty-title">No ranked games yet.</p>
          <p className="cl-empty-sub">Your first analyzed stream is your placement. It puts you on the ladder.</p>
          <Link href="/dashboard/vods" className="btn btn-blue">
            Pick a stream
          </Link>
        </section>
      ) : (
        <>
          <section className="hm-top">
            <RankPanel points={(profile?.rank_points as number | null) ?? null} delta={latestDelta} avgWin={avgWin} />
            <div className="hm-last mh-side">
              {summary.games > 0 ? (
                <MatchSummaryStrip summary={summary} />
              ) : (
                <p className="mh-placed">Placement done. Your next analyzed stream is your first ranked game.</p>
              )}
              {(snapshots?.length ?? 0) > 0 && <FollowerBriefCard snapshots={snapshots ?? []} streamDates={streamDates} />}
            </div>
          </section>

          {isPro && arc && (arc.recurring_improvements.length > 0 || arc.improving_areas.length > 0 || arc.synthesis) && (
            <section className="hm-sec">
              <div className="hm-head">
                <h2>Across your streams</h2>
                <span className="hm-record">Last {arc.score_history.length}</span>
              </div>
              <CoachingArcCard arc={arc} />
            </section>
          )}

          <section className="hm-sec">
            <div className="hm-head">
              <h2>All games</h2>
              <span className="hm-record">{matches.length} total</span>
            </div>
            <MatchHistoryList matches={matches} />
          </section>
        </>
      )}
    </>
  );
}
