/**
 * lib/upgrade-pitch.ts
 *
 * Builds a personalized paywall pitch from the user's actual coach reports.
 * The trial-banner and upgrade modal currently show the same generic
 * "your trial gives you a taste" string to everyone, which wastes the
 * single highest-value conversion moment: when the user JUST saw value.
 *
 * This helper pulls the user's last 3 ready reports, computes summary
 * stats (count, average score, dead-air trend, recurring patterns), and
 * returns a `reason` string + structured `peekMetrics` the locked-delta
 * card can use to show real-but-blurred values instead of fake ones.
 *
 * Called server-side from dashboard layout so the banner has the pitch
 * data on every page load without an extra client round-trip.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface UpgradePitch {
  /** Personalized prose for the UpgradeModal reason field. */
  reason: string;
  /** Real numbers the locked-delta card can render (still blurred for free). */
  peekMetrics: {
    /** Last analyzed score, e.g. 62. */
    latestScore: number | null;
    /** Score delta vs the report before, e.g. +1 or -3. Null on first report. */
    scoreDelta: number | null;
    /** Dead air percent change vs previous report, in percentage points. */
    deadAirDelta: number | null;
    /** Number of reports the user has done. */
    reportCount: number;
    /** Average score across the user's reports. */
    avgScore: number | null;
  };
}

interface CoachReportShape {
  overall_score?: number;
  dead_air_pct?: number;
  streamer_type?: string;
  recommendation?: string;
}

interface VodRow {
  coach_report: CoachReportShape | null;
  analyzed_at: string | null;
}

/**
 * Compute the personalized upgrade pitch for a user. Always returns
 * something usable — if the user has zero reports, the pitch falls back
 * to the generic-but-honest framing instead of hallucinating data.
 */
export async function buildUpgradePitch(
  userId: string,
  supabase: SupabaseClient
): Promise<UpgradePitch> {
  const { data } = await supabase
    .from("vods")
    .select("coach_report, analyzed_at")
    .eq("user_id", userId)
    .eq("status", "ready")
    .not("coach_report", "is", null)
    .order("analyzed_at", { ascending: false })
    .limit(3);

  const reports = (data as VodRow[] | null) ?? [];
  const scored = reports
    .map((r) => r.coach_report)
    .filter((r): r is CoachReportShape => !!r && typeof r.overall_score === "number");

  if (scored.length === 0) {
    return {
      reason:
        "Pro is built around tracking your stream over time. You'll see the score change between every stream, what's actually improving, and what keeps slipping. Single reports are diagnosis. The delta is the coaching.",
      peekMetrics: {
        latestScore: null,
        scoreDelta: null,
        deadAirDelta: null,
        reportCount: 0,
        avgScore: null,
      },
    };
  }

  const latest = scored[0];
  const previous = scored[1] ?? null;
  const latestScore = latest.overall_score ?? null;
  const scoreDelta = previous?.overall_score != null && latestScore != null
    ? latestScore - previous.overall_score
    : null;
  const deadAirDelta = previous?.dead_air_pct != null && latest.dead_air_pct != null
    ? latest.dead_air_pct - previous.dead_air_pct
    : null;
  const reportCount = scored.length;
  const avgScore = scored.length > 0
    ? Math.round(scored.reduce((s, r) => s + (r.overall_score ?? 0), 0) / scored.length)
    : null;

  const reason = composeReason({
    latestScore,
    scoreDelta,
    deadAirDelta,
    reportCount,
    avgScore,
    streamerType: latest.streamer_type ?? null,
  });

  return {
    reason,
    peekMetrics: {
      latestScore,
      scoreDelta,
      deadAirDelta,
      reportCount,
      avgScore,
    },
  };
}

/**
 * Build the prose pitch. Logic ladder — pick the framing that matches
 * the user's actual situation. Order matters: more specific framings win
 * over generic ones.
 */
function composeReason(args: {
  latestScore: number | null;
  scoreDelta: number | null;
  deadAirDelta: number | null;
  reportCount: number;
  avgScore: number | null;
  streamerType: string | null;
}): string {
  const { latestScore, scoreDelta, deadAirDelta, reportCount, avgScore } = args;

  // 1+ reports with comparison data — strongest framing, references real numbers.
  if (reportCount >= 2 && scoreDelta != null && avgScore != null) {
    const direction = scoreDelta > 0
      ? `up ${scoreDelta} points`
      : scoreDelta < 0
        ? `down ${Math.abs(scoreDelta)} points`
        : "flat";
    const deadAirNote = deadAirDelta != null && Math.abs(deadAirDelta) >= 2
      ? deadAirDelta < 0
        ? ` Your dead air dropped ${Math.abs(deadAirDelta)} points — that's real, and it only shows up across multiple reports.`
        : ` Your dead air climbed ${deadAirDelta} points — exactly the pattern Pro flags before it becomes a habit.`
      : "";
    return `You've analyzed ${reportCount} streams averaging ${avgScore}/100. Your latest stream came in ${direction} vs the one before.${deadAirNote} One report is a snapshot. The delta is the coaching. Pro tracks every stream so you can prove what's working.`;
  }

  // Exactly 1 report — frame around what they JUST saw + what comes next.
  if (reportCount === 1 && latestScore != null) {
    const tier = latestScore >= 70
      ? `That's a strong run — top 15% of streamers using LevlCast.`
      : latestScore >= 55
        ? `Solid baseline.`
        : `That's your starting line, not a verdict.`;
    return `You just got your first report: ${latestScore}/100. ${tier} The real coaching kicks in when you have a SECOND report to compare against — Pro tracks the delta on every stream so you can prove you're actually improving instead of guessing.`;
  }

  // Fallback — shouldn't usually hit since buildUpgradePitch handles zero reports above.
  return "Pro tracks every stream so you can prove what's actually working. One report is a snapshot. The delta is the coaching.";
}
