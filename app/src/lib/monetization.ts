/**
 * lib/monetization.ts — Content performance analysis engine.
 *
 * Analyzes which content categories drive the most growth and engagement.
 * Uses existing VOD data (peak categories, coach scores) and follower
 * snapshots to compute a per-category breakdown.
 *
 * Called weekly by the Inngest cron job (compute-content-reports).
 */

interface PeakData {
  category: string;
  score: number;
}

interface VodRow {
  stream_date: string;
  duration_seconds: number;
  peak_data: PeakData[] | null;
  coach_report: { overall_score: number } | null;
}

interface FollowerSnapshot {
  follower_count: number;
  snapped_at: string;
}

export interface CategoryBreakdown {
  category: string;
  vod_count: number;
  avg_score: number;
  total_peaks: number;
  avg_peak_score: number;
  avg_duration_min: number;
  follower_delta: number; // estimated follower impact
  growth_rating: "high" | "medium" | "low"; // relative performance
}

export interface ContentReport {
  categories: CategoryBreakdown[];
  top_category: string | null;
}

/**
 * Compute content category performance from VOD + follower data.
 * Groups VODs by their dominant peak category, then calculates per-category metrics.
 * Requires at least 4 analyzed VODs to produce a meaningful report.
 */
export function computeContentReport(
  vods: VodRow[],
  followers: FollowerSnapshot[]
): ContentReport | null {
  const analyzed = vods
    .filter((v) => v.coach_report?.overall_score !== undefined && v.peak_data?.length)
    .sort((a, b) => new Date(a.stream_date).getTime() - new Date(b.stream_date).getTime());

  if (analyzed.length < 4) return null;

  // Sort followers chronologically
  const sortedFollowers = [...followers].sort(
    (a, b) => new Date(a.snapped_at).getTime() - new Date(b.snapped_at).getTime()
  );

  // Group VODs by dominant category (most frequent peak category in that VOD)
  const categoryVods: Record<string, VodRow[]> = {};

  for (const vod of analyzed) {
    const dominant = dominantCategory(vod.peak_data || []);
    if (!dominant) continue;
    if (!categoryVods[dominant]) categoryVods[dominant] = [];
    categoryVods[dominant].push(vod);
  }

  // For each category, compute metrics
  const categories: CategoryBreakdown[] = [];

  for (const [category, catVods] of Object.entries(categoryVods)) {
    const scores = catVods.map((v) => v.coach_report!.overall_score);
    const avgScore = Math.round(avg(scores));
    const allPeaks = catVods.flatMap((v) => v.peak_data || []);
    const categoryPeaks = allPeaks.filter((p) => p.category === category);
    const avgPeakScore = categoryPeaks.length > 0
      ? Math.round(avg(categoryPeaks.map((p) => p.score)))
      : 0;
    const avgDuration = Math.round(avg(catVods.map((v) => v.duration_seconds)) / 60);

    // Estimate follower impact: follower delta during periods when this category was streamed
    const followerDelta = estimateFollowerImpact(catVods, sortedFollowers);

    categories.push({
      category,
      vod_count: catVods.length,
      avg_score: avgScore,
      total_peaks: categoryPeaks.length,
      avg_peak_score: avgPeakScore,
      avg_duration_min: avgDuration,
      follower_delta: followerDelta,
      growth_rating: "medium", // will be set below
    });
  }

  if (categories.length === 0) return null;

  // Assign growth ratings relative to each other
  // Sort by a composite of avg_score and follower_delta
  const maxDelta = Math.max(...categories.map((c) => Math.abs(c.follower_delta)), 1);
  const maxScore = Math.max(...categories.map((c) => c.avg_score), 1);

  for (const cat of categories) {
    const normalizedDelta = cat.follower_delta / maxDelta;
    const normalizedScore = cat.avg_score / maxScore;
    const composite = normalizedDelta * 0.6 + normalizedScore * 0.4;
    if (composite >= 0.7) cat.growth_rating = "high";
    else if (composite >= 0.35) cat.growth_rating = "medium";
    else cat.growth_rating = "low";
  }

  // Sort by composite performance (growth_rating then avg_score)
  const ratingOrder = { high: 0, medium: 1, low: 2 };
  categories.sort((a, b) => {
    const rDiff = ratingOrder[a.growth_rating] - ratingOrder[b.growth_rating];
    if (rDiff !== 0) return rDiff;
    return b.avg_score - a.avg_score;
  });

  const topCategory = categories.length > 0 ? categories[0].category : null;

  return { categories, top_category: topCategory };
}

/** Pretty label for a peak category */
export function categoryLabel(cat: string): string {
  const labels: Record<string, string> = {
    hype: "Hype",
    funny: "Comedy",
    educational: "Educational",
    emotional: "Emotional",
    clutch_play: "Clutch Plays",
    rage: "Rage",
    wholesome: "Wholesome",
  };
  return labels[cat] || cat.charAt(0).toUpperCase() + cat.slice(1);
}

// --- Helpers ---

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** Find the most common peak category in a VOD's peak data */
function dominantCategory(peaks: PeakData[]): string | null {
  if (peaks.length === 0) return null;
  const counts: Record<string, number> = {};
  for (const p of peaks) {
    counts[p.category] = (counts[p.category] || 0) + 1;
  }
  let best = "";
  let bestCount = 0;
  for (const [cat, count] of Object.entries(counts)) {
    if (count > bestCount) {
      best = cat;
      bestCount = count;
    }
  }
  return best || null;
}

/**
 * Estimate follower impact for VODs in a given category.
 * Looks at follower deltas in the 48-hour window after each stream.
 */
function estimateFollowerImpact(
  vods: VodRow[],
  followers: FollowerSnapshot[]
): number {
  if (followers.length < 2) return 0;

  let totalDelta = 0;

  for (const vod of vods) {
    const streamTime = new Date(vod.stream_date).getTime();
    const windowEnd = streamTime + 48 * 60 * 60 * 1000; // 48 hours after stream

    // Find closest follower snapshot before and after
    const before = findClosestBefore(followers, streamTime);
    const after = findClosestAfter(followers, windowEnd);

    if (before !== null && after !== null) {
      totalDelta += after - before;
    }
  }

  return totalDelta;
}

function findClosestBefore(followers: FollowerSnapshot[], timestamp: number): number | null {
  let closest: FollowerSnapshot | null = null;
  for (const f of followers) {
    const t = new Date(f.snapped_at).getTime();
    if (t <= timestamp) closest = f;
    else break;
  }
  return closest?.follower_count ?? null;
}

function findClosestAfter(followers: FollowerSnapshot[], timestamp: number): number | null {
  for (const f of followers) {
    const t = new Date(f.snapped_at).getTime();
    if (t >= timestamp) return f.follower_count;
  }
  return null;
}
