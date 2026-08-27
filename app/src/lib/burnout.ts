/**
 * lib/burnout.ts — Burnout detection scoring engine.
 *
 * Computes a composite burnout score (0-100) from six signals derived
 * entirely from data already in the database (vods, coach_report, follower_snapshots).
 *
 * Higher score = higher burnout risk. Thresholds:
 *   0-25:  Healthy
 *   26-45: Watch
 *   46-65: Warning
 *   66-100: Alert
 *
 * Called once per week by the Inngest cron job (compute-burnout-score).
 */

interface CoachReport {
  overall_score: number;
  energy_trend: string;
  viewer_retention_risk: string;
}

interface VodRow {
  stream_date: string;
  duration_seconds: number;
  coach_report: CoachReport | null;
}

interface FollowerSnapshot {
  follower_count: number;
  snapped_at: string;
}

export interface BurnoutSignals {
  scoreTrend: number;       // 0-100: how much coach scores are declining
  energyDecline: number;    // 0-100: frequency of declining/volatile energy
  sessionShortening: number;// 0-100: are sessions getting shorter?
  frequencyDrop: number;    // 0-100: are gaps between streams growing?
  retentionRisk: number;    // 0-100: frequency of high retention risk
  growthStall: number;      // 0-100: is follower growth slowing?
  composite: number;        // weighted average (0-100)
}

const WEIGHTS = {
  scoreTrend: 0.25,
  energyDecline: 0.20,
  sessionShortening: 0.20,
  frequencyDrop: 0.20,
  retentionRisk: 0.10,
  growthStall: 0.05,
};

/**
 * Compute burnout signals from raw VOD + follower data.
 * Requires at least 6 analyzed VODs to produce a meaningful score.
 * Returns null if insufficient data.
 */
export function computeBurnout(
  vods: VodRow[],
  followers: FollowerSnapshot[]
): BurnoutSignals | null {
  // Need at least 6 analyzed VODs with coach reports
  const analyzed = vods
    .filter((v) => v.coach_report?.overall_score !== undefined)
    .sort((a, b) => new Date(a.stream_date).getTime() - new Date(b.stream_date).getTime());

  if (analyzed.length < 6) return null;

  // Take last 12 at most (recent history, not ancient)
  const recent = analyzed.slice(-12);
  const half = Math.floor(recent.length / 2);
  const older = recent.slice(0, half);
  const newer = recent.slice(half);

  // --- Signal 1: Score Trend (are coach scores declining?) ---
  const olderScores = older.map((v) => v.coach_report!.overall_score);
  const newerScores = newer.map((v) => v.coach_report!.overall_score);
  const olderAvg = avg(olderScores);
  const newerAvg = avg(newerScores);
  // If scores dropped 20+ points, that's maximum signal
  const scoreDelta = olderAvg - newerAvg; // positive = declining
  const scoreTrend = clamp(scoreDelta * 5, 0, 100); // 20pt drop → 100

  // --- Signal 2: Energy Decline (declining/volatile energy trend) ---
  const badEnergy = newer.filter(
    (v) => v.coach_report!.energy_trend === "declining" || v.coach_report!.energy_trend === "volatile"
  ).length;
  const energyDecline = clamp((badEnergy / newer.length) * 100, 0, 100);

  // --- Signal 3: Session Shortening ---
  const olderDurations = older.map((v) => v.duration_seconds);
  const newerDurations = newer.map((v) => v.duration_seconds);
  const olderDurAvg = avg(olderDurations);
  const newerDurAvg = avg(newerDurations);
  // If sessions are 30%+ shorter, that's maximum signal
  const durDelta = olderDurAvg > 0 ? (olderDurAvg - newerDurAvg) / olderDurAvg : 0;
  const sessionShortening = clamp(durDelta * 333, 0, 100); // 30% shorter → 100

  // --- Signal 4: Frequency Drop (gaps between streams increasing?) ---
  const olderGaps = computeGaps(older);
  const newerGaps = computeGaps(newer);
  const olderGapAvg = olderGaps.length > 0 ? avg(olderGaps) : 0;
  const newerGapAvg = newerGaps.length > 0 ? avg(newerGaps) : 0;
  // If average gap doubled, that's maximum signal
  const gapRatio = olderGapAvg > 0 ? newerGapAvg / olderGapAvg : 1;
  const frequencyDrop = clamp((gapRatio - 1) * 100, 0, 100); // 2x gap → 100

  // --- Signal 5: Retention Risk ---
  const highRisk = newer.filter(
    (v) => v.coach_report!.viewer_retention_risk === "high"
  ).length;
  const retentionRisk = clamp((highRisk / newer.length) * 100, 0, 100);

  // --- Signal 6: Growth Stall ---
  const sortedFollowers = [...followers].sort(
    (a, b) => new Date(a.snapped_at).getTime() - new Date(b.snapped_at).getTime()
  );
  let growthStall = 0;
  if (sortedFollowers.length >= 14) {
    const fHalf = Math.floor(sortedFollowers.length / 2);
    const olderF = sortedFollowers.slice(0, fHalf);
    const newerF = sortedFollowers.slice(fHalf);
    const olderGrowth = olderF.length >= 2
      ? olderF[olderF.length - 1].follower_count - olderF[0].follower_count
      : 0;
    const newerGrowth = newerF.length >= 2
      ? newerF[newerF.length - 1].follower_count - newerF[0].follower_count
      : 0;
    // If growth halved or reversed, signal is high
    if (olderGrowth > 0) {
      const growthRatio = newerGrowth / olderGrowth;
      growthStall = clamp((1 - growthRatio) * 100, 0, 100);
    } else if (newerGrowth < 0) {
      growthStall = 80; // losing followers
    }
  }

  // --- Composite ---
  const composite = Math.round(
    scoreTrend * WEIGHTS.scoreTrend +
    energyDecline * WEIGHTS.energyDecline +
    sessionShortening * WEIGHTS.sessionShortening +
    frequencyDrop * WEIGHTS.frequencyDrop +
    retentionRisk * WEIGHTS.retentionRisk +
    growthStall * WEIGHTS.growthStall
  );

  return {
    scoreTrend: Math.round(scoreTrend),
    energyDecline: Math.round(energyDecline),
    sessionShortening: Math.round(sessionShortening),
    frequencyDrop: Math.round(frequencyDrop),
    retentionRisk: Math.round(retentionRisk),
    growthStall: Math.round(growthStall),
    composite: clamp(composite, 0, 100),
  };
}

export function burnoutLabel(score: number): string {
  if (score <= 25) return "healthy";
  if (score <= 45) return "watch";
  if (score <= 65) return "warning";
  return "alert";
}

// --- Helpers ---

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Compute gaps (in days) between consecutive VODs. */
function computeGaps(vods: VodRow[]): number[] {
  const gaps: number[] = [];
  for (let i = 1; i < vods.length; i++) {
    const prev = new Date(vods[i - 1].stream_date).getTime();
    const curr = new Date(vods[i].stream_date).getTime();
    gaps.push((curr - prev) / (1000 * 60 * 60 * 24));
  }
  return gaps;
}
