/**
 * lib/collab.ts — Collab matching algorithm.
 *
 * Scores potential collab partners based on:
 *   1. Content overlap (30%) — shared peak categories
 *   2. Audience similarity (30%) — follower count within reasonable range
 *   3. Quality match (20%) — similar coach scores
 *   4. Complementary strengths (20%) — different top categories = fresh collab
 *
 * Higher score = better match. Only matches users who have opted in.
 */

export interface UserProfile {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  followerCount: number;
  avgScore: number;
  topCategories: string[]; // ordered by frequency, e.g. ["hype", "funny"]
  burnoutScore: number;
}

export interface CollabMatch {
  matchUserId: string;
  score: number; // 0-100
  reasons: string[];
}

/**
 * Score a potential match between two streamers.
 * Returns null if they shouldn't be matched (burnout too high, etc.)
 */
export function scoreMatch(
  user: UserProfile,
  candidate: UserProfile,
  preferences?: { minFollowers?: number; maxFollowers?: number; preferredCategories?: string[] }
): CollabMatch | null {
  // Skip if candidate is burnt out
  if (candidate.burnoutScore > 65) return null;

  // Skip if candidate doesn't meet follower preferences
  if (preferences?.minFollowers && candidate.followerCount < preferences.minFollowers) return null;
  if (preferences?.maxFollowers && candidate.followerCount > preferences.maxFollowers) return null;

  const reasons: string[] = [];
  let totalScore = 0;

  // --- 1. Content Overlap (30%) ---
  const sharedCategories = user.topCategories.filter((c) =>
    candidate.topCategories.includes(c)
  );
  const overlapRatio = user.topCategories.length > 0
    ? sharedCategories.length / Math.max(user.topCategories.length, candidate.topCategories.length)
    : 0;
  const contentScore = overlapRatio * 100;
  totalScore += contentScore * 0.3;

  if (sharedCategories.length > 0) {
    const labels = sharedCategories.map(categoryLabel);
    reasons.push(`Both create ${labels.join(" & ").toLowerCase()} content`);
  }

  // --- 2. Audience Similarity (30%) ---
  const bigger = Math.max(user.followerCount, candidate.followerCount);
  const smaller = Math.min(user.followerCount, candidate.followerCount);
  // Perfect match = same size. Up to 5x difference is acceptable, beyond that drops fast
  const sizeRatio = bigger > 0 ? smaller / bigger : 1;
  const audienceScore = Math.min(sizeRatio * 1.5, 1) * 100; // 67%+ ratio = full score
  totalScore += audienceScore * 0.3;

  if (sizeRatio >= 0.5) {
    reasons.push("Similar audience size");
  } else if (sizeRatio >= 0.2) {
    reasons.push("Could introduce you to a larger audience");
  }

  // --- 3. Quality Match (20%) ---
  const scoreDiff = Math.abs(user.avgScore - candidate.avgScore);
  const qualityScore = Math.max(0, 100 - scoreDiff * 5); // 20pt diff = 0
  totalScore += qualityScore * 0.2;

  if (scoreDiff <= 10) {
    reasons.push("Similar stream quality level");
  }

  // --- 4. Complementary Strengths (20%) ---
  // Having DIFFERENT top categories means a collab could bring fresh content
  const uniqueToCandidate = candidate.topCategories.filter(
    (c) => !user.topCategories.includes(c)
  );
  const complementScore = uniqueToCandidate.length > 0 ? 70 : 30;
  totalScore += complementScore * 0.2;

  if (uniqueToCandidate.length > 0) {
    const label = categoryLabel(uniqueToCandidate[0]);
    reasons.push(`Brings ${label.toLowerCase()} content you don't typically do`);
  }

  // Bonus: preferred category match
  if (preferences?.preferredCategories?.length) {
    const prefMatch = candidate.topCategories.some((c) =>
      preferences.preferredCategories!.includes(c)
    );
    if (prefMatch) {
      totalScore = Math.min(totalScore + 10, 100);
      reasons.push("Matches your collab preferences");
    }
  }

  const finalScore = Math.round(Math.min(totalScore, 100));
  if (finalScore < 30) return null; // too low to suggest

  return {
    matchUserId: candidate.userId,
    score: finalScore,
    reasons: reasons.slice(0, 3), // max 3 reasons
  };
}

/**
 * Build a UserProfile from database rows.
 */
export function buildUserProfile(
  userId: string,
  displayName: string,
  avatarUrl: string | null,
  followerCount: number,
  vods: { peak_data: any[]; coach_report: { overall_score: number } | null }[],
  burnoutScore: number
): UserProfile {
  // Get top categories from peak data
  const catCounts: Record<string, number> = {};
  for (const vod of vods) {
    for (const peak of vod.peak_data || []) {
      if (peak.category) {
        catCounts[peak.category] = (catCounts[peak.category] || 0) + 1;
      }
    }
  }
  const topCategories = Object.entries(catCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat]) => cat);

  // Average coach score
  const scores = vods
    .map((v) => v.coach_report?.overall_score)
    .filter((s): s is number => s !== undefined && s !== null);
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

  return {
    userId,
    displayName,
    avatarUrl,
    followerCount,
    avgScore,
    topCategories,
    burnoutScore,
  };
}

function categoryLabel(cat: string): string {
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
