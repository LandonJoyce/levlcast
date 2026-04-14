/**
 * lib/collab.ts — Collab matching algorithm.
 *
 * Two modes:
 *   1. Internal — match LevlCast users with each other (full data)
 *   2. External — find live Twitch streamers in the same games with similar audience size
 *
 * Scoring weights (internal):
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
  const sizeRatio = bigger > 0 ? smaller / bigger : 1;
  const audienceScore = Math.min(sizeRatio * 1.5, 1) * 100;
  totalScore += audienceScore * 0.3;

  if (sizeRatio >= 0.5) {
    reasons.push("Similar audience size");
  } else if (sizeRatio >= 0.2) {
    reasons.push("Could introduce you to a larger audience");
  }

  // --- 3. Quality Match (20%) ---
  const scoreDiff = Math.abs(user.avgScore - candidate.avgScore);
  const qualityScore = Math.max(0, 100 - scoreDiff * 5);
  totalScore += qualityScore * 0.2;

  if (scoreDiff <= 10) {
    reasons.push("Similar stream quality level");
  }

  // --- 4. Complementary Strengths (20%) ---
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
  if (finalScore < 30) return null;

  return {
    matchUserId: candidate.userId,
    score: finalScore,
    reasons: reasons.slice(0, 3),
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

  const scores = vods
    .map((v) => v.coach_report?.overall_score)
    .filter((s): s is number => s !== undefined && s !== null);
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

  return { userId, displayName, avatarUrl, followerCount, avgScore, topCategories, burnoutScore };
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
  viewerCount: number;
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
 * Find live Twitch streamers who play the same games as the user.
 * Accepts actual game names derived from the user's VOD titles.
 * Filters by viewer count range based on user's follower count.
 * Only returns live, active streamers with real audiences.
 */
export async function findExternalStreamers(
  userProfile: UserProfile,
  gameNames: string[], // actual game names extracted from user's VOD titles
  excludeTwitchIds: string[],
  limit = 8
): Promise<ExternalMatch[]> {
  if (gameNames.length === 0) return [];

  const token = await getAppAccessToken();
  const clientId = process.env.TWITCH_CLIENT_ID!;
  const headers = {
    "Client-ID": clientId,
    Authorization: `Bearer ${token}`,
  };

  // Step 1: Resolve game names → game IDs
  const gameIds: { id: string; name: string }[] = [];
  for (const name of gameNames.slice(0, 4)) {
    try {
      const params = new URLSearchParams({ name });
      const res = await fetch(`https://api.twitch.tv/helix/games?${params}`, { headers });
      if (!res.ok) continue;
      const data = await res.json();
      const game = data.data?.[0];
      if (game) gameIds.push({ id: game.id, name: game.name });
    } catch {
      // skip
    }
  }

  if (gameIds.length === 0) return [];

  // Step 2: Loose viewer count ceiling — only filter out massive streamers
  // Small/mid streamers (< 50k followers) should see anyone with < 5k viewers
  const followers = userProfile.followerCount || 0;
  const maxViewers = followers > 50000 ? Math.floor(followers * 0.2) : 5000;

  // Step 3: Fetch live streams for each game
  const seenIds = new Set(excludeTwitchIds);
  const candidates: ExternalStreamer[] = [];

  for (const game of gameIds) {
    try {
      const params = new URLSearchParams({ game_id: game.id, first: "100" });
      const res = await fetch(`https://api.twitch.tv/helix/streams?${params}`, { headers });
      if (!res.ok) continue;

      const data = await res.json();
      for (const stream of data.data || []) {
        if (seenIds.has(stream.user_id)) continue;

        // Only filter out huge streamers and zero-viewer bots
        if (stream.viewer_count > maxViewers) continue;
        if (stream.viewer_count === 0) continue;

        // Filter: skip obvious bot/spam channels
        if (isSuspiciousLogin(stream.user_login)) continue;

        seenIds.add(stream.user_id);
        candidates.push({
          twitchId: stream.user_id,
          login: stream.user_login,
          displayName: stream.user_name,
          avatarUrl: stream.thumbnail_url?.replace("{width}", "40").replace("{height}", "40") || "",
          viewerCount: stream.viewer_count,
          followerCount: 0,
          gameName: stream.game_name || game.name,
          isLive: true,
        });
      }
    } catch {
      // non-fatal
    }
  }

  // Step 3b: If no live streams found, fall back to channel search for the game
  if (candidates.length === 0) {
    for (const game of gameIds.slice(0, 2)) {
      try {
        const params = new URLSearchParams({ query: game.name, first: "30" });
        const res = await fetch(`https://api.twitch.tv/helix/search/channels?${params}`, { headers });
        if (!res.ok) continue;
        const data = await res.json();
        for (const ch of data.data || []) {
          if (seenIds.has(ch.id)) continue;
          if (isSuspiciousLogin(ch.broadcaster_login)) continue;
          seenIds.add(ch.id);
          candidates.push({
            twitchId: ch.id,
            login: ch.broadcaster_login,
            displayName: ch.display_name,
            avatarUrl: ch.thumbnail_url || "",
            viewerCount: 0,
            followerCount: 0,
            gameName: ch.game_name || game.name,
            isLive: ch.is_live,
          });
        }
      } catch {
        // non-fatal
      }
    }
  }

  if (candidates.length === 0) return [];

  // Step 4: Fetch profile images
  try {
    const ids = candidates.slice(0, 100).map((s) => s.twitchId);
    const params = new URLSearchParams();
    for (const id of ids) params.append("id", id);
    const res = await fetch(`https://api.twitch.tv/helix/users?${params}`, { headers });
    if (res.ok) {
      const data = await res.json();
      for (const u of data.data || []) {
        const c = candidates.find((s) => s.twitchId === u.id);
        if (c) c.avatarUrl = u.profile_image_url || c.avatarUrl;
      }
    }
  } catch {
    // non-fatal
  }

  // Step 5: Score candidates
  const matches: ExternalMatch[] = [];

  for (const streamer of candidates) {
    const reasons: string[] = [];
    let score = 60; // base score for matching the game

    reasons.push(`Streams ${streamer.gameName}`);

    // Live bonus
    if (streamer.isLive) {
      score += 20;
      reasons.push("Currently live");
    }

    // Viewer count similarity bonus (small streamers prefer similar-sized partners)
    if (streamer.viewerCount > 0 && followers > 0) {
      const expectedViewers = Math.max(followers * 0.02, 3);
      const ratio = streamer.viewerCount / expectedViewers;
      if (ratio >= 0.3 && ratio <= 5) {
        score += 20;
        reasons.push("Similar audience size");
      }
    }

    matches.push({
      streamer,
      score: Math.round(Math.min(score, 100)),
      reasons: reasons.slice(0, 3),
    });
  }

  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, limit);
}

/**
 * Filter out suspicious / bot-like Twitch logins.
 * Real streamers have recognizable names, not just keywords + numbers.
 */
function isSuspiciousLogin(login: string): boolean {
  // All lowercase letters + numbers pattern with common spam words
  const spamPrefixes = [
    "just_chatting", "justchatting", "just_chat",
    "twitch_tv", "stream_", "live_", "watch_",
  ];
  const lower = login.toLowerCase();
  if (spamPrefixes.some((p) => lower.startsWith(p) && /\d/.test(lower))) return true;

  // Ends with 2+ digits after a common word
  if (/^[a-z_]+\d{2,}$/.test(lower) && lower.length < 15) return true;

  return false;
}
