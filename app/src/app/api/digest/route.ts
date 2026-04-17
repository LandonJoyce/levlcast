/**
 * GET  /api/digest — returns the user's latest weekly digest + history.
 * POST /api/digest — generates a digest for the current user immediately.
 *
 * Response: { latest: WeeklyDigest | null, history: WeeklyDigest[] }
 */

import { NextResponse } from "next/server";
import { createClientFromRequest, createAdminClient } from "@/lib/supabase/server";
import { getUserUsage } from "@/lib/limits";
import { rateLimit } from "@/lib/rate-limit";
import Anthropic from "@anthropic-ai/sdk";

export async function GET(request: Request) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const usage = await getUserUsage(user.id, supabase);
    if (usage.plan === "free") {
      return NextResponse.json({ locked: true, latest: null, history: [] });
    }

    const { data: digests, error } = await supabase
      .from("weekly_digests")
      .select("*")
      .eq("user_id", user.id)
      .order("week_start", { ascending: false })
      .limit(8);

    if (error) {
      console.error("[api/digest] Query failed:", error.message);
      return NextResponse.json({ latest: null, history: [] });
    }

    const history = digests || [];
    const latest = history.length > 0 ? history[0] : null;

    // Compute whether a refresh is needed:
    // 1. The stored digest is from a different week window than today
    // 2. OR the user has analyzed a new VOD in the last 24h (fresh data worth reflecting)
    const expectedWeekStart = new Date();
    expectedWeekStart.setDate(expectedWeekStart.getDate() - 7);
    const expectedWeekStartStr = expectedWeekStart.toISOString().split("T")[0];
    const weekChanged = !latest || latest.week_start !== expectedWeekStartStr;

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentAnalyses } = await supabase
      .from("vods")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "ready")
      .gte("analyzed_at", yesterday);

    const needs_refresh = weekChanged || (recentAnalyses ?? 0) > 0;

    return NextResponse.json({ latest, history: history.reverse(), needs_refresh });
  } catch (err) {
    console.error("[api/digest] Unexpected error:", err);
    return NextResponse.json({ latest: null, history: [] });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 5 digest generations per hour per user — prevents Anthropic cost abuse
    if (!rateLimit(`digest:${user.id}`, 5, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
    }

    const usage = await getUserUsage(user.id, supabase);
    if (usage.plan === "free") {
      return NextResponse.json({ error: "Pro required" }, { status: 403 });
    }

    const admin = createAdminClient();
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const weekStartStr = weekStart.toISOString().split("T")[0];
    const weekStartIso = weekStart.toISOString();

    const [vodsRes, clipsRes, followerRes, burnoutRes, contentRes, collabRes] = await Promise.all([
      admin.from("vods").select("duration_seconds, coach_report, peak_data")
        .eq("user_id", user.id).eq("status", "ready").gte("stream_date", weekStartIso),
      admin.from("clips").select("id")
        .eq("user_id", user.id).gte("created_at", weekStartIso),
      admin.from("follower_snapshots").select("follower_count, snapped_at")
        .eq("user_id", user.id).eq("platform", "twitch").gte("snapped_at", weekStartIso)
        .order("snapped_at", { ascending: true }),
      admin.from("burnout_snapshots").select("score, insight")
        .eq("user_id", user.id).order("computed_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("content_reports").select("top_category, insight")
        .eq("user_id", user.id).order("period_start", { ascending: false }).limit(1).maybeSingle(),
      admin.from("collab_suggestions").select("id")
        .eq("user_id", user.id).eq("status", "new"),
    ]);

    const vods = vodsRes.data || [];
    const clips = clipsRes.data || [];
    const followers = followerRes.data || [];
    const burnout = burnoutRes.data;
    const content = contentRes.data;
    const collabCount = collabRes.data?.length || 0;

    // If no VODs this week, look back further so they still get a digest
    const allVodsRes = vods.length === 0
      ? await admin.from("vods").select("duration_seconds, coach_report, peak_data")
          .eq("user_id", user.id).eq("status", "ready").order("stream_date", { ascending: false }).limit(5)
      : null;
    const vodsForDigest = vods.length > 0 ? vods : (allVodsRes?.data || []);

    if (vodsForDigest.length === 0) {
      return NextResponse.json({ error: "No analyzed VODs yet" }, { status: 400 });
    }

    const usingFallback = vods.length === 0;
    // Stats shown to user reflect THIS week only — fallback VODs only inform the AI advice
    const streamsCount = usingFallback ? 0 : vods.length;
    const totalDurationMin = usingFallback ? 0 : Math.round(vods.reduce((s: number, v: any) => s + (v.duration_seconds || 0), 0) / 60);
    const scores = vodsForDigest.map((v: any) => (v.coach_report as any)?.overall_score).filter(Boolean) as number[];
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : null;
    const bestScore = scores.length > 0 ? Math.max(...scores) : null;
    const peaksFound = vodsForDigest.reduce((s: number, v: any) => s + ((v.peak_data as any[])?.length || 0), 0);
    const clipsGenerated = clips.length;

    let followerDelta = 0;
    if (followers.length >= 2) {
      followerDelta = followers[followers.length - 1].follower_count - followers[0].follower_count;
    }

    const healthSummary = burnout?.insight || (burnout?.score !== undefined
      ? (burnout.score <= 25 ? "You're in good shape." : burnout.score <= 45 ? "A few minor signals, nothing concerning." : "Some fatigue signals — check your Health card.")
      : null);
    const contentSummary = content?.insight || (content?.top_category ? `Your ${content.top_category} content performed best recently.` : null);
    const collabSummary = collabCount > 0 ? `${collabCount} new collab match${collabCount > 1 ? "es" : ""} waiting for you.` : null;

    let headline = `${streamsCount} stream${streamsCount !== 1 ? "s" : ""} analyzed`;
    if (avgScore) headline += `, avg score ${avgScore}`;
    let actionItems: string[] = [];

    try {
      const anthropic = new Anthropic();
      const msg = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{
          role: "user",
          content: `You are a streamer's personal manager writing their weekly digest.

Data:
- Streams this week: ${streamsCount}${usingFallback ? " (none this week — context from recent past streams below)" : `, total ${totalDurationMin} minutes`}
${usingFallback ? `- Recent stream context: avg score ${avgScore || "N/A"}, ${peaksFound} peaks found across last ${vodsForDigest.length} streams` : `- Avg coach score: ${avgScore || "N/A"}, best: ${bestScore || "N/A"}\n- Peaks found: ${peaksFound}`}
- Clips generated this week: ${clipsGenerated}
- Follower change: ${followerDelta >= 0 ? "+" : ""}${followerDelta}
- Health: ${healthSummary || "No data"}
- Content: ${contentSummary || "No data"}
- Collab matches: ${collabCount}

Generate:
1. "headline": One punchy sentence summarizing the week. Honest, not fluffy. If they didn't stream, acknowledge it directly.
2. "actions": 2-3 short specific action items based on the data.

JSON only: { "headline": "...", "actions": ["...", "..."] }`,
        }],
      });
      const text = msg.content[0].type === "text" ? msg.content[0].text : "";
      const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.headline) headline = parsed.headline;
      if (parsed.actions) actionItems = parsed.actions;
    } catch {
      if (avgScore && avgScore < 70) actionItems.push("Review your latest coach report for quick wins.");
      if (peaksFound > 0 && clipsGenerated === 0) actionItems.push("You have peaks waiting — generate some clips.");
    }

    await admin.from("weekly_digests").upsert(
      {
        user_id: user.id,
        week_start: weekStartStr,
        streams_count: streamsCount,
        total_duration_min: totalDurationMin,
        avg_score: avgScore,
        best_score: bestScore,
        peaks_found: peaksFound,
        clips_generated: clipsGenerated,
        follower_delta: followerDelta,
        headline,
        health_summary: healthSummary,
        content_summary: contentSummary,
        collab_summary: collabSummary,
        action_items: actionItems,
      },
      { onConflict: "user_id,week_start" }
    );

    return NextResponse.json({ ok: true, headline });
  } catch (err) {
    console.error("[api/digest] POST error:", err);
    return NextResponse.json({ error: "Failed to generate digest" }, { status: 500 });
  }
}
