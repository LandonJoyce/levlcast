/**
 * lib/collab-match.ts
 *
 * Lightweight match scoring for the Collab Finder browse view. NOT the old
 * algorithmic-matching cron — that was retired. This just sorts opted-in
 * users by relevance to the caller so the list isn't pure chronological.
 *
 * Inputs are already-loaded summaries (no DB calls here). All inputs are
 * derived from data we already store; no new fields needed.
 */

export interface CollabUserSummary {
  user_id: string;
  display_name: string;
  twitch_login: string;
  avatar_url: string | null;
  /** Most recent coach_report.overall_score, or null if no report yet. */
  latest_score: number | null;
  /** coach_report.streamer_type from the latest report. */
  streamer_type: string | null;
  /** Distinct game_category values across last 5 VODs, ordered by recency. */
  recent_game_categories: string[];
  /** Latest follower count snapshot for Twitch. */
  follower_count: number | null;
  /** Collab types they're open to (co_stream | variety_swap | podcast). */
  collab_types: string[];
  /** When they opted in — used as a tie-breaker. */
  opt_in_at: string | null;
}

/**
 * Compute a 0-100 match score between two opted-in users. Higher is better.
 * Signal weights are intentionally conservative — we want the list to feel
 * varied, not algorithmically narrow.
 */
export function scoreMatch(me: CollabUserSummary, other: CollabUserSummary): number {
  let score = 50; // neutral baseline so unranked users still surface

  // Game category overlap — strongest signal because shared games = easy collab format
  const mySet = new Set(me.recent_game_categories);
  const overlap = other.recent_game_categories.filter((g) => mySet.has(g)).length;
  if (overlap >= 1) score += 15;
  if (overlap >= 2) score += 10;

  // Streamer type match — gaming with gaming, IRL with IRL feels natural
  if (
    me.streamer_type &&
    other.streamer_type &&
    me.streamer_type === other.streamer_type
  ) {
    score += 12;
  }

  // Audience size proximity — same order of magnitude is the sweet spot.
  // Pairing a 50-viewer with a 50,000-viewer wastes both sides' time.
  if (me.follower_count != null && other.follower_count != null) {
    const a = Math.max(me.follower_count, 1);
    const b = Math.max(other.follower_count, 1);
    const ratio = a > b ? a / b : b / a;
    if (ratio <= 2) score += 12;
    else if (ratio <= 5) score += 6;
    else if (ratio <= 10) score += 2;
    // beyond 10x, no bonus
  }

  // Coach-score band proximity — closer skill levels collab more comfortably
  if (me.latest_score != null && other.latest_score != null) {
    const diff = Math.abs(me.latest_score - other.latest_score);
    if (diff <= 5) score += 8;
    else if (diff <= 15) score += 4;
  }

  return Math.max(0, Math.min(100, score));
}

/** Friendly label for a game_category code. */
export function gameCategoryLabel(code: string): string {
  switch (code) {
    case "mmo": return "MMO";
    case "fps": return "FPS";
    case "battle_royale": return "Battle Royale";
    case "moba": return "MOBA";
    case "fighting": return "Fighting";
    case "card_game": return "Card";
    case "racing": return "Racing";
    case "sandbox": return "Sandbox";
    case "general": return "Variety";
    default: return code;
  }
}

/** Friendly label for streamer_type from coach reports. */
export function streamerTypeLabel(t: string | null): string | null {
  if (!t) return null;
  switch (t) {
    case "gaming": return "Gaming";
    case "just_chatting": return "Just Chatting";
    case "irl": return "IRL";
    case "variety": return "Variety";
    case "educational": return "Educational";
    default: return t.charAt(0).toUpperCase() + t.slice(1);
  }
}

/** Coarse audience size band — keeps the UI from looking like a stats page. */
export function audienceBand(followerCount: number | null): string {
  if (followerCount == null) return "—";
  if (followerCount < 50) return "Under 50";
  if (followerCount < 200) return "~100";
  if (followerCount < 500) return "~250";
  if (followerCount < 1000) return "~500";
  if (followerCount < 5000) return "~2K";
  if (followerCount < 10000) return "~5K";
  if (followerCount < 50000) return "~25K";
  return "50K+";
}
