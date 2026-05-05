/**
 * lib/ad-optimizer.ts — Ad placement and revenue optimization engine.
 *
 * Works entirely from existing VOD data (peak_data + duration) — no
 * Twitch ad API access required. Uses peak timestamps to find dead-air
 * windows (safe ad spots) and community moment peaks (do NOT interrupt).
 *
 * Called by GET /api/ad-optimizer.
 */

interface Peak {
  title: string;
  start: number; // seconds
  end: number;   // seconds
  score: number; // 0.0 - 1.0
  category: string;
}

interface VodRow {
  id: string;
  title: string;
  stream_date: string;
  duration_seconds: number;
  peak_data: Peak[] | null;
  view_count?: number | null;
}

export interface AdWindow {
  start_min: number;
  end_min: number;
  gap_min: number;
  quality: "ideal" | "ok"; // ideal = 12+ min gap, ok = 8-12 min
}

export interface CommunityMoment {
  title: string;
  minute: number;
  category: string;
  score: number;
}

export interface AdOptimizerReport {
  vod_id: string;
  vod_title: string;
  stream_date: string;
  duration_min: number;
  // Ad placement
  ad_windows: AdWindow[];
  optimal_breaks: number;        // how many ad breaks the algorithm recommends
  recommended_breaks: number;    // what they actually have windows for
  // Community signals
  community_moments: CommunityMoment[];
  // Insight + advice
  insight: string;
  recommendation: string;
  // Revenue estimate
  estimated_cpm_tier: "low" | "mid" | "high"; // based on view_count if available
}

// Categories that typically correlate with community events (subs, gifted subs, raids)
const COMMUNITY_CATEGORIES = new Set(["hype", "wholesome", "funny"]);

// Twitch affiliate CPM tiers (rough estimates — actual varies)
// Low: < 50 concurrent, Mid: 50-200, High: 200+
function cpmTier(viewCount?: number | null, durationMin?: number): "low" | "mid" | "high" {
  if (!viewCount || !durationMin || durationMin <= 0) return "low";
  // Rough concurrent estimate: total views / (duration_hours * ~2.5 avg sessions/hour)
  const estConcurrent = viewCount / Math.max(1, (durationMin / 60) * 2.5);
  if (estConcurrent >= 200) return "high";
  if (estConcurrent >= 50) return "mid";
  return "low";
}

function secToMin(s: number): number {
  return Math.round(s / 60);
}

/**
 * Compute ad placement report for a single VOD.
 */
export function computeAdReport(vod: VodRow): AdOptimizerReport | null {
  const peaks = (vod.peak_data || []).filter((p) => p.start !== undefined && p.end !== undefined);
  const durationMin = Math.round((vod.duration_seconds || 0) / 60);

  if (durationMin < 10) return null; // Too short to bother

  // Sort peaks by start time
  const sorted = [...peaks].sort((a, b) => a.start - b.start);

  // Find dead-air windows: gaps between peaks (and before first / after last)
  // Minimum gap to be a usable ad window: 8 minutes
  const MIN_GAP_SEC = 8 * 60;
  const SKIP_START_SEC = 8 * 60; // don't run ads in first 8 min

  const adWindows: AdWindow[] = [];

  // Window before first peak
  const firstPeakStart = sorted.length > 0 ? sorted[0].start : vod.duration_seconds;
  if (firstPeakStart >= SKIP_START_SEC + MIN_GAP_SEC) {
    const gapMin = secToMin(firstPeakStart - SKIP_START_SEC);
    adWindows.push({
      start_min: secToMin(SKIP_START_SEC),
      end_min: secToMin(firstPeakStart),
      gap_min: gapMin,
      quality: gapMin >= 12 ? "ideal" : "ok",
    });
  }

  // Gaps between peaks
  for (let i = 0; i < sorted.length - 1; i++) {
    const gapStart = sorted[i].end;
    const gapEnd = sorted[i + 1].start;
    const gapSec = gapEnd - gapStart;
    if (gapSec >= MIN_GAP_SEC) {
      const gapMin = secToMin(gapSec);
      adWindows.push({
        start_min: secToMin(gapStart),
        end_min: secToMin(gapEnd),
        gap_min: gapMin,
        quality: gapMin >= 12 ? "ideal" : "ok",
      });
    }
  }

  // Window after last peak
  const lastPeakEnd = sorted.length > 0 ? sorted[sorted.length - 1].end : 0;
  const afterGapSec = vod.duration_seconds - lastPeakEnd;
  if (afterGapSec >= MIN_GAP_SEC && lastPeakEnd > 0) {
    const gapMin = secToMin(afterGapSec);
    adWindows.push({
      start_min: secToMin(lastPeakEnd),
      end_min: durationMin,
      gap_min: gapMin,
      quality: gapMin >= 12 ? "ideal" : "ok",
    });
  }

  // Community moments (hype/wholesome/funny peaks = likely sub/community events)
  const communityMoments: CommunityMoment[] = sorted
    .filter((p) => COMMUNITY_CATEGORIES.has(p.category))
    .map((p) => ({
      title: p.title,
      minute: secToMin(p.start),
      category: p.category,
      score: p.score,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  // Optimal breaks: 1 break per 25 minutes of content (Twitch affiliate sweet spot)
  const optimalBreaks = Math.max(1, Math.floor(durationMin / 25));
  const recommendedBreaks = Math.min(adWindows.length, optimalBreaks);

  const tier = cpmTier(vod.view_count, durationMin);

  // Build human-readable insight
  const insight = buildInsight(adWindows, communityMoments, durationMin, optimalBreaks, tier);
  const recommendation = buildRecommendation(adWindows, communityMoments, optimalBreaks);

  return {
    vod_id: vod.id,
    vod_title: vod.title,
    stream_date: vod.stream_date,
    duration_min: durationMin,
    ad_windows: adWindows,
    optimal_breaks: optimalBreaks,
    recommended_breaks: recommendedBreaks,
    community_moments: communityMoments,
    insight,
    recommendation,
    estimated_cpm_tier: tier,
  };
}

function buildInsight(
  windows: AdWindow[],
  community: CommunityMoment[],
  durationMin: number,
  optimalBreaks: number,
  tier: "low" | "mid" | "high"
): string {
  if (windows.length === 0) {
    return `Your ${durationMin}-minute stream had peak moments back-to-back with no clear ad breaks. Running ads during high-energy segments drives viewers away. Wait for natural lulls.`;
  }
  const idealWindows = windows.filter((w) => w.quality === "ideal");
  const hasEnough = windows.length >= optimalBreaks;
  const communityNote = community.length > 0
    ? ` Your stream had ${community.length} community moment${community.length > 1 ? "s" : ""} — those are when subs and gifted subs tend to spike.`
    : "";

  if (hasEnough) {
    return `Your ${durationMin}-minute stream has ${idealWindows.length > 0 ? idealWindows.length + " ideal" : windows.length} natural ad window${windows.length !== 1 ? "s" : ""} where viewers are least likely to leave.${communityNote}`;
  }
  return `Your ${durationMin}-minute stream has only ${windows.length} clear ad window${windows.length !== 1 ? "s" : ""} but ideally you'd have ${optimalBreaks}. Your peaks are packed close together. Good for engagement, tight for ad revenue.${communityNote}`;
}

function buildRecommendation(
  windows: AdWindow[],
  community: CommunityMoment[],
  optimalBreaks: number
): string {
  if (windows.length === 0) {
    return "Structure your next stream with deliberate breather segments (game loading screens, setup moments, or viewer Q&A) so you have natural spots to run ads without hurting retention.";
  }

  const bestWindows = [...windows]
    .sort((a, b) => b.gap_min - a.gap_min)
    .slice(0, optimalBreaks);

  const windowStr = bestWindows
    .map((w) => `${w.start_min}-${w.end_min} min`)
    .join(", ");

  const communityWarning = community.length > 0
    ? ` Avoid ads within 3 minutes of your community moments (${community.map((c) => c.minute + " min").join(", ")}) — those windows are when subs and gifted subs tend to happen.`
    : "";

  return `Run ${bestWindows.length} ad break${bestWindows.length !== 1 ? "s" : ""} at your quietest windows: ${windowStr}.${communityWarning}`;
}

/**
 * Aggregate insights across multiple VODs — finds patterns.
 */
export interface AdOptimizerSummary {
  reports: AdOptimizerReport[];
  avg_windows_per_stream: number;
  avg_optimal_breaks: number;
  coverage_pct: number; // what % of optimal breaks they can fill with real windows
  top_community_category: string | null;
  pattern_insight: string;
}

export function summarizeAdReports(reports: AdOptimizerReport[]): AdOptimizerSummary {
  if (reports.length === 0) {
    return {
      reports: [],
      avg_windows_per_stream: 0,
      avg_optimal_breaks: 0,
      coverage_pct: 0,
      top_community_category: null,
      pattern_insight: "Analyze more streams to unlock ad optimization insights.",
    };
  }

  const avgWindows = Math.round(
    reports.reduce((s, r) => s + r.ad_windows.length, 0) / reports.length
  );
  const avgOptimal = Math.round(
    reports.reduce((s, r) => s + r.optimal_breaks, 0) / reports.length
  );
  const coveragePct = avgOptimal > 0
    ? Math.round(Math.min(100, (avgWindows / avgOptimal) * 100))
    : 100;

  // Find most common community moment category
  const catCounts: Record<string, number> = {};
  for (const r of reports) {
    for (const m of r.community_moments) {
      catCounts[m.category] = (catCounts[m.category] || 0) + 1;
    }
  }
  let topCat: string | null = null;
  let topCount = 0;
  for (const [cat, count] of Object.entries(catCounts)) {
    if (count > topCount) { topCat = cat; topCount = count; }
  }

  const patternInsight = buildPatternInsight(avgWindows, avgOptimal, coveragePct, topCat, reports.length);

  return {
    reports,
    avg_windows_per_stream: avgWindows,
    avg_optimal_breaks: avgOptimal,
    coverage_pct: coveragePct,
    top_community_category: topCat,
    pattern_insight: patternInsight,
  };
}

function buildPatternInsight(
  avgWindows: number,
  avgOptimal: number,
  coveragePct: number,
  topCat: string | null,
  streamCount: number
): string {
  const catLabel: Record<string, string> = {
    hype: "hype",
    wholesome: "wholesome",
    funny: "comedy",
  };

  const communityStr = topCat
    ? ` Your community spikes most during ${catLabel[topCat] || topCat} moments. These are your best opportunities for gifted subs and raids, so never run ads there.`
    : "";

  if (coveragePct >= 80) {
    return `Across ${streamCount} stream${streamCount !== 1 ? "s" : ""}, you consistently have ${avgWindows} natural ad windows${avgWindows !== 1 ? "s" : ""}. Enough to hit your optimal ${avgOptimal} break${avgOptimal !== 1 ? "s" : ""} without interrupting peak moments.${communityStr}`;
  }
  if (coveragePct >= 50) {
    return `Your streams average ${avgWindows} usable ad window${avgWindows !== 1 ? "s" : ""} out of an ideal ${avgOptimal}. You're leaving some revenue on the table. Try adding deliberate pauses (loading screens, setup, chat reading) to create more natural break points.${communityStr}`;
  }
  return `Your content is dense. Peaks come in rapid succession leaving few safe ad spots. That's great for engagement but hurts ad revenue. Consider one intentional breather segment per hour to create ad-friendly windows without hurting the flow.${communityStr}`;
}
