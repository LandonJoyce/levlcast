/**
 * lib/collab.ts — Collab matching algorithm.
 *
 * Two modes:
 *   1. Internal — match LevlCast users with each other (full data)
 *   2. External — find Twitch streamers via Helix API (audience size + category)
 *
 * Scoring weights:
 *   Content overlap (30%), Audience similarity (30%),
 *   Quality match (20%), Complementary strengths (20%)
 */

import { getAppAccessToken } from "./twitch";

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

// ─── External Twitch Streamer Discovery ──────────────────────────────────

export interface ExternalStreamer {
  twitchId: string;
  login: string;
  displayName: string;
  avatarUrl: string;
  followerCount: number;
  gameName: string;
  isLive: boolean;
}

export interface ExternalMatch {
  streamer: ExternalStreamer;
  score: number;
  reasons: string[];
}

/**
 * Map peak categories to Twitch game/category search terms.
 * Twitch doesn't categorize by "hype" — but we can search for popular
 * game categories that tend to produce that content style.
 */
const CATEGORY_SEARCH_TERMS: Record<string, string[]> = {
  hype: ["Just Chatting", "Fortnite", "Valorant", "Call of Duty"],
  funny: ["Just Chatting", "Gartic Phone", "Among Us", "Gang Beasts"],
  educational: ["Just Chatting", "Software and Game Development", "Science & Technology"],
  emotional: ["Just Chatting", "Art", "Music"],
  clutch_play: ["Valorant", "League of Legends", "Apex Legends", "Counter-Strike"],
  rage: ["Dark Souls", "Elden Ring", "Getting Over It", "Jump King"],
  wholesome: ["Stardew Valley", "Animal Crossing", "Art", "Music"],
};

/**
 * Find external Twitch streamers who could be good collab partners.
 * Uses Twitch Helix API search/channels (app access token — no user scopes needed).
 *
 * Note: Follower counts are NOT available via app tokens (requires moderator:read:followers).
 * We score based on category match and live status instead.
 */
export async function findExternalStreamers(
  userProfile: UserProfile,
  excludeTwitchIds: string[],
  limit = 10
): Promise<ExternalMatch[]> {
  const token = await getAppAccessToken();
  const clientId = process.env.TWITCH_CLIENT_ID!;
  const headers = {
    "Client-ID": clientId,
    Authorization: `Bearer ${token}`,
  };

  // Build search terms from user's top categories
  const searchTerms = new Set<string>();
  for (const cat of userProfile.topCategories) {
    const terms = CATEGORY_SEARCH_TERMS[cat] || ["Just Chatting"];
    for (const t of terms) searchTerms.add(t);
  }

  // Search for channels in each relevant category
  const allStreamers: ExternalStreamer[] = [];
  const seenIds = new Set(excludeTwitchIds);

  for (const term of [...searchTerms].slice(0, 4)) {
    try {
      const params = new URLSearchParams({ query: term, first: "20", live_only: "false" });
      const res = await fetch(`https://api.twitch.tv/helix/search/channels?${params}`, { headers });
      if (!res.ok) continue;

      const data = await res.json();
      for (const ch of data.data || []) {
        if (seenIds.has(ch.id)) continue;
        seenIds.add(ch.id);

        allStreamers.push({
          twitchId: ch.id,
          login: ch.broadcaster_login,
          displayName: ch.display_name,
          avatarUrl: ch.thumbnail_url,
          followerCount: 0, // not available via app token
          gameName: ch.game_name || term,
          isLive: ch.is_live,
        });
      }
    } catch {
      // non-fatal, skip this category
    }
  }

  if (allStreamers.length === 0) return [];

  // Fetch profile images from /helix/users (works with app token)
  try {
    const ids = allStreamers.slice(0, 100).map((s) => s.twitchId);
    const params = new URLSearchParams();
    for (const id of ids) params.append("id", id);
    const res = await fetch(`https://api.twitch.tv/helix/users?${params}`, { headers });
    if (res.ok) {
      const data = await res.json();
      for (const u of data.data || []) {
        const streamer = allStreamers.find((s) => s.twitchId === u.id);
        if (streamer) {
          streamer.avatarUrl = u.profile_image_url || streamer.avatarUrl;
        }
      }
    }
  } catch {
    // non-fatal — keep the thumbnail_url from search
  }

  // Score each candidate based on category relevance and live status
  const matches: ExternalMatch[] = [];

  for (const streamer of allStreamers) {
    const reasons: string[] = [];
    let score = 0;

    // Category relevance (60% weight — primary matching signal for external)
    const gameLower = streamer.gameName.toLowerCase();
    let categoryMatch = false;
    for (const cat of userProfile.topCategories) {
      const terms = CATEGORY_SEARCH_TERMS[cat] || [];
      if (terms.some((t) => t.toLowerCase() === gameLower)) {
        categoryMatch = true;
        break;
      }
    }

    if (categoryMatch) {
      score += 60;
      reasons.push(`Streams ${streamer.gameName}`);
    } else {
      score += 20;
      if (streamer.gameName) reasons.push(`Streams ${streamer.gameName}`);
    }

    // Live bonus (25% — live streamers are active and reachable)
    if (streamer.isLive) {
      score += 25;
      reasons.push("Currently live");
    } else {
      score += 10;
    }

    // Base score for being a real candidate (15%)
    score += 15;

    if (score < 40) continue;

    matches.push({
      streamer,
      score: Math.round(Math.min(score, 100)),
      reasons: reasons.slice(0, 3),
    });
  }

  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, limit);
}
