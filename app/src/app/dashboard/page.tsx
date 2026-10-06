import Link from "next/link";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { buildMatchHistory, summarizeMatches, type MatchVodRow } from "@/lib/match-history";
import { getLeagueResults, getLeagueView, previousWeekStart, withoutSealed } from "@/lib/league";
import { isLocked, isPlacementResult, isSealed, lockOpensAt, pointsBeforeSealed, sealedLeaguePoints } from "@/lib/sealed";
import { SealedResult } from "@/components/dashboard/sealed-result";
import { FriendsSection } from "@/components/dashboard/friends-section";
import { getDuelsForUser } from "@/lib/duels";
import { getFriendLeagues } from "@/lib/friend-leagues";
import { currentWeekStart } from "@/lib/limits";
import { MatchHistoryList, recordLabel } from "@/components/dashboard/match-history";
import { LeagueCard } from "@/components/dashboard/league-card";
import WelcomeModal from "@/components/dashboard/welcome-modal";
import PendingVodHandler from "@/components/dashboard/pending-vod-handler";
import PendingCheckoutHandler from "@/components/dashboard/pending-checkout-handler";
import { UnpostedClipsCard } from "@/components/dashboard/unposted-clips-card";
import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist";
import { OnboardingHero } from "@/components/dashboard/onboarding-hero";
import { VodStatusPoller } from "@/components/dashboard/vod-status-poller";
import { AdminReplyCard } from "@/components/dashboard/admin-reply-card";
import { RankPanel } from "@/components/dashboard/rank-panel";
import { AddToObsButton, LivePromo } from "@/components/dashboard/add-to-obs";

// ─── helpers ─────────────────────────────────────────────

/* Removed: GradientWords, which painted every word of eight letters or
   more in the brand gradient. It emphasised by word LENGTH, so
   "consecutive", "documented", "capability" and "something" all lit up
   while the actual instruction sat in plain text. Highlighting that
   correlates with nothing is the clearest signal a page was assembled
   rather than written, and it actively worked against the sentence: the
   reader's eye jumped between long words instead of reading the advice.
   The recommendation renders as plain text now and says what it says. */

function formatDate(iso: string | null): string {
  if (!iso) return "...";
  const d = new Date(iso);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "...";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const Icons = {
  Twitch: () => (
    <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
      <path d="M4 5l2-3h14v12l-5 5h-4l-3 3H6v-3H2V8l2-3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="M11 8v5M16 8v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  Spark: () => (
    <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
      <path d="M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
    </svg>
  ),
  Trend: () => (
    <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
      <path d="M3 17l6-6 4 4 8-8M14 7h7v7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Arrow: () => (
    <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
      <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Play: () => (
    <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
      <path d="M7 5l12 7-12 7V5z" fill="currentColor"/>
    </svg>
  ),
  Chev: () => (
    <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

// ─── page ────────────────────────────────────────────────

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { syncing: syncingParam } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("twitch_display_name, rank_points, plan, subscription_expires_at, created_at")
    .eq("id", user.id)
    .single();

  // Latest analyzed VODs — most recent first, up to 12 for trend
  const { data: recentVods } = await supabase
    .from("vods")
    .select("id, title, duration_seconds, analyzed_at, stream_date, coach_report, created_at, peak_data, rank_delta, rank_points_after")
    .eq("user_id", user.id)
    .eq("status", "ready")
    .order("stream_date", { ascending: false, nullsFirst: false })
    .order("analyzed_at", { ascending: false, nullsFirst: false })
    .limit(12);

  const totalAnalyzed = recentVods?.length ?? 0;
  const latest = recentVods?.[0];
  const latestRecommendation = (latest?.coach_report as { recommendation?: string } | null)?.recommendation ?? null;
  const latestPeaks = Array.isArray(latest?.peak_data) ? latest.peak_data.length : 0;

  // Unposted ready clips — up to 10 most recent
  const { data: readyClips } = await supabase
    .from("clips")
    .select("id, title, peak_category")
    .eq("user_id", user.id)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(10);

  const readyClipIds = (readyClips ?? []).map((c) => c.id);
  const { data: postedClips } = readyClipIds.length > 0
    ? await supabase.from("social_posts").select("clip_id").eq("user_id", user.id).eq("platform", "youtube").in("clip_id", readyClipIds)
    : { data: [] };
  const postedSet = new Set((postedClips ?? []).map((p) => p.clip_id));
  const unpostedClips = (readyClips ?? []).filter((c) => !postedSet.has(c.id));

  const { data: ytConnection } = await supabase
    .from("social_connections")
    .select("id")
    .eq("user_id", user.id)
    .eq("platform", "youtube")
    .maybeSingle();
  const isYouTubeConnected = !!ytConnection;

  const displayName = profile?.twitch_display_name || "Streamer";
  // For the Live card and window: what Pro adds, or what they already have.
  const livePro =
    profile?.plan === "pro" &&
    !(profile.subscription_expires_at && new Date(profile.subscription_expires_at as string) < new Date());

  // Live gets introduced here until the panel has been open during one of
  // their streams. A read that fails just leaves the introduction up.
  const { count: liveCount } = await supabase
    .from("live_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  const showLivePromo = !liveCount;

  // ─── Empty state — no streams analyzed yet ─────────────
  if (totalAnalyzed === 0) {
    // Detect whether an analysis is currently running so we can poll the
    // page and reload the moment it flips to ready. The OnboardingHero
    // component does its own deeper query for the in-progress row's
    // title/status — this is just the cheap boolean for the poller.
    const { count: inProgressCount } = await supabase
      .from("vods")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .in("status", ["transcribing", "analyzing"]);
    const hasInProgressAnalysis = (inProgressCount ?? 0) > 0;
    // Sign-in syncs a new streamer's VODs before sending them anywhere, but
    // it stops waiting on Twitch after a few seconds and says so with
    // ?syncing=1. Then an empty list means "not synced yet", not "no saved
    // broadcasts", for the next couple of minutes.
    const createdAt = Date.parse(String(profile?.created_at ?? ""));
    const syncing =
      syncingParam === "1" && Number.isFinite(createdAt) && Date.now() - createdAt < 2 * 60 * 1000;
    // Someone who arrived through a duel or friend-league invite should
    // see it here before their first report, not only after.
    const newAdmin = createAdminClient();
    const [newDuels, newLeagues] = await Promise.all([
      getDuelsForUser(newAdmin, user.id).catch(() => ({ active: [], recent: [], openCode: null })),
      getFriendLeagues(newAdmin, user.id).catch(() => []),
    ]);
    const hasSocial = newDuels.active.length > 0 || newDuels.openCode !== null || newLeagues.length > 0;

    return (
      <>
        <WelcomeModal name={displayName} />
        <PendingCheckoutHandler />
        <PendingVodHandler />
        <VodStatusPoller hasProcessing={hasInProgressAnalysis || syncing} />

        <div className="hm-hello">
          <h1 className="page-title">Hey, {displayName}.</h1>
        </div>

        <AdminReplyCard />
        <OnboardingHero syncing={syncing} />
        {showLivePromo && <LivePromo pro={livePro} />}
        {hasSocial && <FriendsSection duels={newDuels} leagues={newLeagues} />}
      </>
    );
  }

  // ─── Populated state ───────────────────────────────────
  // Match history and this week's league. League tables are closed to the
  // browser, so they are read through the admin client; the helpers only
  // return public fields. Every read here fails soft: a league problem
  // must never take the dashboard down with it.
  const admin = createAdminClient();
  const [{ data: rankedVods }, { data: leagueSettings }, leagueView, recentResults, duels, friendLeagues] = await Promise.all([
    supabase
      .from("vods")
      .select("id, title, analyzed_at, stream_date, created_at, duration_seconds, rank_delta, rank_points_after, result_opened_at, result_call, sealed_extra_week")
      .eq("user_id", user.id)
      .eq("status", "ready"),
    supabase.from("profiles").select("league_opt_out").eq("id", user.id).maybeSingle(),
    getLeagueView(admin, user.id).catch(() => null),
    // Enough settled weeks that any payout inside the rows shown below is
    // there; the newest one doubles as "last week" on the league card.
    getLeagueResults(admin, user.id, { limit: 6 }).catch(() => []),
    getDuelsForUser(admin, user.id).catch(() => ({ active: [], recent: [], openCode: null })),
    getFriendLeagues(admin, user.id).catch(() => []),
  ]);

  const matches = buildMatchHistory((rankedVods ?? []) as MatchVodRow[], recentResults);
  const matchSummary = summarizeMatches(matches);
  const leagueOptOut = Boolean((leagueSettings as { league_opt_out?: boolean } | null)?.league_opt_out);
  const lastWeekResult =
    recentResults[0]?.weekStart === previousWeekStart(currentWeekStart()) ? recentResults[0] : null;
  const latestDelta = (latest?.rank_delta as number | null) ?? null;
  // A placement records the whole starting rating as its delta, which
  // isn't a win or a loss.
  const latestResult = latestDelta !== null && Math.abs(latestDelta) < 200 ? latestDelta : null;
  // Sealed results: analyzed, not opened. Until they're opened nothing on
  // this page gives them away: the rank shows as it stood before them, the
  // league leaves them out, and the newest one takes the last-stream spot.
  const isPro =
    profile?.plan === "pro" &&
    !(profile.subscription_expires_at && new Date(profile.subscription_expires_at as string) < new Date());
  const byAnalyzed = [...(rankedVods ?? [])].sort((a, b) =>
    String(b.analyzed_at ?? "").localeCompare(String(a.analyzed_at ?? ""))
  );
  const sealedVods = byAnalyzed.filter((v) => isSealed({ ...v, status: "ready" }));
  const sealedTop = sealedVods[0] ?? null;
  const opened = byAnalyzed.filter((v) => !isSealed({ ...v, status: "ready" }));
  const rankPoints = (profile?.rank_points as number | null) ?? null;
  const shownPoints = sealedVods.length ? pointsBeforeSealed(rankPoints, sealedVods) : rankPoints;
  const shownDelta = sealedVods.length ? null : ((opened[0]?.rank_delta as number | null) ?? null);
  const weekStartIso = `${currentWeekStart()}T00:00:00.000Z`;
  const sealedThisWeek = sealedVods.filter((v) => String(v.analyzed_at ?? "") >= weekStartIso);
  const league =
    leagueView && sealedVods.length
      ? withoutSealed(leagueView, sealedLeaguePoints(sealedThisWeek), sealedThisWeek.length, shownPoints)
      : leagueView;

  // What a win usually pays this streamer, for "about 3 wins" under the bar.
  const recentWins = opened
    .slice(0, 12)
    .map((v) => v.rank_delta as number | null)
    .filter((d): d is number => d !== null && d > 0 && d < 200);
  const avgWin = recentWins.length
    ? Math.round(recentWins.reduce((a, b) => a + b, 0) / recentWins.length)
    : null;

  /* The dashboard used to stack about ten cards: a greeting, the rank and
     goal, the league, unposted clips, the coaching arc, a follower brief, a
     row of totals, a Pro pitch and the match history, with Pro-only extras
     on top. Most of it was reference, and the page read as a column of
     equally loud things. It's four now: where you stand and what to fix,
     who you're racing, your last few matches, and clips waiting to go out.
     The arc and the follower brief live on the Matches page; the plan and
     the upgrade are the chip in the bar. */
  return (
    <>
      <PendingCheckoutHandler />
      <PendingVodHandler />

      <div className="hm-hello">
        <h1 className="page-title">Hey, {displayName}.</h1>
        <div className="hm-hello-actions">
          <AddToObsButton className="btn btn-ghost" pro={livePro}>
            Add to OBS
          </AddToObsButton>
          <Link href="/dashboard/vods" className="btn btn-ghost">
            <Icons.Twitch /> Analyze a stream
          </Link>
        </div>
      </div>

      <OnboardingChecklist />
      <AdminReplyCard />
      {showLivePromo && <LivePromo pro={livePro} />}

      <section className="hm-top">
        {/* Keyed on the points so opening a result remounts it and the
            count-up plays from the old rank to the new one. */}
        <RankPanel key={String(shownPoints)} points={shownPoints} delta={shownDelta} avgWin={avgWin} />

        {sealedTop ? (
          <div className="hm-last">
            <SealedResult
              vodId={sealedTop.id as string}
              title={(sealedTop.title as string | null) ?? null}
              placement={isPlacementResult(sealedTop)}
              locked={
                isLocked({ ...sealedTop, status: "ready" }, isPro) && sealedTop.sealed_extra_week
                  ? { opensAt: lockOpensAt(sealedTop.sealed_extra_week as string) }
                  : null
              }
              variant="home"
            />
          </div>
        ) : (
        <div className="hm-last">
          <p className="hm-k">
            Last stream
            <span>
              {formatDate(latest?.stream_date ?? latest?.analyzed_at ?? latest?.created_at ?? null)} ·{" "}
              {formatDuration(latest?.duration_seconds ?? null)}
            </span>
          </p>
          <p className="hm-last-title">{latest?.title || "Your most recent broadcast"}</p>
          {latestResult !== null && (
            <p className="hm-result" data-r={latestResult >= 0 ? "win" : "loss"}>
              <b>{latestResult >= 0 ? "Win" : "Loss"}</b>
              <span>{latestResult >= 0 ? `+${latestResult}` : `−${Math.abs(latestResult)}`}</span>
            </p>
          )}
          <p className="hm-k hm-k-fix">Your fix for next stream</p>
          <p className="hm-fix">{latestRecommendation || "Open the report to see what to work on next."}</p>
          <div className="hm-actions">
            <Link href={`/dashboard/vods/${latest?.id}`} className="btn btn-blue">
              Open the report <Icons.Arrow />
            </Link>
            {latestPeaks > 0 && (
              <Link href="/dashboard/clips" className="btn btn-ghost">
                {latestPeaks} {latestPeaks === 1 ? "moment" : "moments"} to clip
              </Link>
            )}
          </div>
        </div>
        )}
      </section>

      {/* The league sits right under the rank: the rank says where you
          stand, the league says who you're racing to get further. */}
      {!leagueOptOut && (
        <section className="hm-sec">
          <LeagueCard view={league} lastResult={lastWeekResult} sealedStreams={sealedThisWeek.length} />
        </section>
      )}

      {/* Duels and friend leagues: the social side, both run on invite links. */}
      <FriendsSection
        duels={duels}
        leagues={
          sealedVods.length
            ? friendLeagues.map((l) => ({
                ...l,
                standings: l.standings.map((s) => (s.isYou ? { ...s, rankPoints: shownPoints } : s)),
                you: l.you ? { ...l.you, rankPoints: shownPoints } : null,
              }))
            : friendLeagues
        }
      />

      <section className="hm-sec">
        <div className="hm-head">
          <h2>Recent matches</h2>
          {matchSummary.games > 0 && (
            <span className="hm-record">
              {recordLabel(matchSummary)} · last {matchSummary.games}
            </span>
          )}
          <Link href="/dashboard/history" className="hm-more">
            All matches <Icons.Arrow />
          </Link>
        </div>
        <MatchHistoryList matches={matches.slice(0, 4)} />
      </section>

      {unpostedClips.length > 0 && (
        <section className="hm-sec">
          <UnpostedClipsCard clips={unpostedClips} isYouTubeConnected={isYouTubeConnected} />
        </section>
      )}
    </>
  );
}
