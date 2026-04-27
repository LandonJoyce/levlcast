/**
 * lib/report-delta.ts
 *
 * Compares two coach reports and produces a "did you do it?" recap.
 * Used by the Last Stream Recap card to give returning users visceral
 * proof that LevlCast remembers what they tried — the longitudinal
 * value that AI wrappers can't replicate without persistent state.
 *
 * The delta is intentionally conservative: claims are gated on
 * concrete signals (anti_patterns, dead_zones, score_breakdown,
 * cold_open). Free-text goal matching uses keyword heuristics and
 * is presented with hedged language ("looks addressed") rather than
 * absolute claims, so a wrong match doesn't burn user trust.
 */

import type { CoachReport } from "./analyze";

export interface ScoreDelta {
  current: number;
  previous: number;
  delta: number;
}

export interface DeadAirDelta {
  prevCount: number;
  prevTotalSec: number;
  currentCount: number;
  currentTotalSec: number;
  improved: boolean;
}

export interface AntiPatternChange {
  type: string;
  prevCount: number;
  currentCount: number;
  /** Newly flagged this stream that wasn't last stream */
  newThisStream: boolean;
  /** Was flagged last stream and isn't anymore */
  cleared: boolean;
  /** Was flagged both streams */
  recurring: boolean;
}

export interface MissionCheck {
  goal: string;
  /** "achieved" — measurable signal moved the right direction
   *  "regressed" — opposite direction
   *  "ongoing"  — couldn't tell from signals (free-text we can't measure) */
  status: "achieved" | "regressed" | "ongoing";
  /** Short human-readable evidence ("Dead air went from 12% → 6.8%") */
  evidence: string;
}

export interface SubScoreDelta {
  key: "energy" | "engagement" | "consistency" | "content";
  current: number;
  previous: number;
  delta: number;
}

export interface ReportDelta {
  score: ScoreDelta;
  subscores: SubScoreDelta[];
  deadAir: DeadAirDelta | null;
  antiPatterns: AntiPatternChange[];
  missions: MissionCheck[];
  /** Most-improved sub-score, surfaced as the headline win */
  biggestWin: SubScoreDelta | null;
  /** Sub-score that regressed most, if any */
  biggestRegression: SubScoreDelta | null;
}

const SUBSCORE_KEYS = ["energy", "engagement", "consistency", "content"] as const;

function deadAirDuration(report: CoachReport): { count: number; totalSec: number } {
  const gaps = report.dead_zones ?? [];
  return {
    count: gaps.length,
    totalSec: Math.round(gaps.reduce((sum, g) => sum + (g.duration ?? 0), 0)),
  };
}

function countAntiPatterns(report: CoachReport): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const ap of report.anti_patterns ?? []) {
    counts[ap.type] = (counts[ap.type] ?? 0) + 1;
  }
  return counts;
}

const ANTI_PATTERN_LABEL: Record<string, string> = {
  viewer_count_apology: "Apologizing for viewer count",
  follow_begging: "Asking for follows",
  lurker_shaming: "Shaming lurkers",
  pre_stream_drain: "Pre-stream drain talk",
  self_defeat: "Self-defeating talk",
};

/**
 * Heuristically check whether a free-text "next_stream_goal" was
 * achieved by mapping its keywords to the current report's measurable
 * signals. Returns hedged status — never claim a free-text match if
 * we don't have hard evidence.
 */
function evaluateMission(
  goal: string,
  prev: CoachReport,
  current: CoachReport
): MissionCheck {
  const lower = goal.toLowerCase();

  const prevDA = deadAirDuration(prev);
  const curDA = deadAirDuration(current);
  const prevAP = countAntiPatterns(prev);
  const curAP = countAntiPatterns(current);

  // Dead air / silence
  if (/dead[\s-]?air|silence|silent|quiet/.test(lower)) {
    if (curDA.totalSec < prevDA.totalSec * 0.7) {
      return {
        goal,
        status: "achieved",
        evidence: `Dead air ${formatDur(prevDA.totalSec)} → ${formatDur(curDA.totalSec)}`,
      };
    }
    if (curDA.totalSec > prevDA.totalSec * 1.3) {
      return {
        goal,
        status: "regressed",
        evidence: `Dead air went up: ${formatDur(prevDA.totalSec)} → ${formatDur(curDA.totalSec)}`,
      };
    }
    return {
      goal,
      status: "ongoing",
      evidence: `Dead air similar to last stream (${formatDur(curDA.totalSec)})`,
    };
  }

  // Viewer count apology
  if (/apolog|viewer count|low view|small audien/.test(lower)) {
    if ((prevAP.viewer_count_apology ?? 0) > 0 && (curAP.viewer_count_apology ?? 0) === 0) {
      return { goal, status: "achieved", evidence: "No viewer-count apology flagged this stream" };
    }
    if ((curAP.viewer_count_apology ?? 0) > (prevAP.viewer_count_apology ?? 0)) {
      return { goal, status: "regressed", evidence: `Flagged ${curAP.viewer_count_apology} time(s) this stream` };
    }
    if ((curAP.viewer_count_apology ?? 0) > 0) {
      return { goal, status: "regressed", evidence: `Still flagged this stream` };
    }
  }

  // Follow begging
  if (/follow|begg|sub goal|reminder.*follow/.test(lower)) {
    if ((prevAP.follow_begging ?? 0) > 0 && (curAP.follow_begging ?? 0) === 0) {
      return { goal, status: "achieved", evidence: "No follow-begging flagged this stream" };
    }
    if ((curAP.follow_begging ?? 0) > 0) {
      return { goal, status: "regressed", evidence: "Still flagged this stream" };
    }
  }

  // Lurker shaming
  if (/lurker|silent chat|chat respond/.test(lower)) {
    if ((prevAP.lurker_shaming ?? 0) > 0 && (curAP.lurker_shaming ?? 0) === 0) {
      return { goal, status: "achieved", evidence: "No lurker-shaming flagged this stream" };
    }
  }

  // Energy / pacing
  if (/energy|pacing|enthusias|hype/.test(lower)) {
    const prevE = prev.score_breakdown?.energy ?? 0;
    const curE = current.score_breakdown?.energy ?? 0;
    if (prevE > 0 && curE > 0) {
      if (curE - prevE >= 5) {
        return { goal, status: "achieved", evidence: `Energy score ${prevE} → ${curE}` };
      }
      if (prevE - curE >= 5) {
        return { goal, status: "regressed", evidence: `Energy score ${prevE} → ${curE}` };
      }
      return { goal, status: "ongoing", evidence: `Energy score ${curE} (was ${prevE})` };
    }
  }

  // Cold open / first 10 / opener
  if (/cold open|opening|first \d+ min|start.*stream|hit the ground/.test(lower)) {
    const rank = (s?: string) => (s === "strong" ? 2 : s === "average" ? 1 : 0);
    const prevR = rank(prev.cold_open?.score);
    const curR = rank(current.cold_open?.score);
    if (curR > prevR) {
      return { goal, status: "achieved", evidence: `Cold open: ${prev.cold_open?.score ?? "?"} → ${current.cold_open?.score ?? "?"}` };
    }
    if (curR < prevR) {
      return { goal, status: "regressed", evidence: `Cold open: ${prev.cold_open?.score ?? "?"} → ${current.cold_open?.score ?? "?"}` };
    }
  }

  // Engagement / chat interaction
  if (/chat|engage|interact|respond/.test(lower)) {
    const prevE = prev.score_breakdown?.engagement ?? 0;
    const curE = current.score_breakdown?.engagement ?? 0;
    if (prevE > 0 && curE > 0) {
      if (curE - prevE >= 5) {
        return { goal, status: "achieved", evidence: `Engagement score ${prevE} → ${curE}` };
      }
      if (prevE - curE >= 5) {
        return { goal, status: "regressed", evidence: `Engagement score ${prevE} → ${curE}` };
      }
    }
  }

  // Default: we can't tell from signals — overall trend as fallback
  const overallDelta = current.overall_score - prev.overall_score;
  return {
    goal,
    status: "ongoing",
    evidence: overallDelta > 0
      ? `Overall up ${overallDelta} pts — hard to tie directly to this`
      : `Hard to measure from this stream's signals`,
  };
}

function formatDur(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export function antiPatternLabel(type: string): string {
  return ANTI_PATTERN_LABEL[type] ?? type.replace(/_/g, " ");
}

export function computeReportDelta(prev: CoachReport, current: CoachReport): ReportDelta {
  // Score delta
  const score: ScoreDelta = {
    current: current.overall_score,
    previous: prev.overall_score,
    delta: current.overall_score - prev.overall_score,
  };

  // Sub-score deltas (only when both reports have score_breakdown)
  const subscores: SubScoreDelta[] = [];
  if (prev.score_breakdown && current.score_breakdown) {
    for (const k of SUBSCORE_KEYS) {
      const p = prev.score_breakdown[k];
      const c = current.score_breakdown[k];
      if (typeof p === "number" && typeof c === "number") {
        subscores.push({ key: k, previous: p, current: c, delta: c - p });
      }
    }
  }

  const biggestWin = subscores.length > 0
    ? subscores.reduce((best, s) => (s.delta > best.delta ? s : best), subscores[0])
    : null;
  const biggestRegression = subscores.length > 0
    ? subscores.reduce((worst, s) => (s.delta < worst.delta ? s : worst), subscores[0])
    : null;

  // Dead air delta
  const prevDA = deadAirDuration(prev);
  const curDA = deadAirDuration(current);
  const deadAir: DeadAirDelta | null = (prevDA.count > 0 || curDA.count > 0)
    ? {
        prevCount: prevDA.count,
        prevTotalSec: prevDA.totalSec,
        currentCount: curDA.count,
        currentTotalSec: curDA.totalSec,
        improved: curDA.totalSec < prevDA.totalSec,
      }
    : null;

  // Anti-pattern changes — union of types in either report
  const prevAP = countAntiPatterns(prev);
  const curAP = countAntiPatterns(current);
  const allTypes = new Set([...Object.keys(prevAP), ...Object.keys(curAP)]);
  const antiPatterns: AntiPatternChange[] = Array.from(allTypes).map((type) => {
    const prevCount = prevAP[type] ?? 0;
    const currentCount = curAP[type] ?? 0;
    return {
      type,
      prevCount,
      currentCount,
      newThisStream: prevCount === 0 && currentCount > 0,
      cleared: prevCount > 0 && currentCount === 0,
      recurring: prevCount > 0 && currentCount > 0,
    };
  });

  // Missions check — evaluate each prior next_stream_goal
  const missions: MissionCheck[] = (prev.next_stream_goals ?? []).map((goal) =>
    evaluateMission(goal, prev, current)
  );

  return {
    score,
    subscores,
    deadAir,
    antiPatterns,
    missions,
    biggestWin: biggestWin && biggestWin.delta > 0 ? biggestWin : null,
    biggestRegression: biggestRegression && biggestRegression.delta < 0 ? biggestRegression : null,
  };
}

export function formatSeconds(sec: number): string {
  return formatDur(sec);
}
