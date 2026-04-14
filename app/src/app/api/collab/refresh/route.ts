/**
 * POST /api/collab/refresh
 * Runs collab matching on-demand for the current user.
 * Finds both internal (other LevlCast users) and external (live Twitch streamers in same games).
 */

import { NextResponse } from "next/server";
import { createClientFromRequest, createAdminClient } from "@/lib/supabase/server";
import { buildUserProfile, scoreMatch, findExternalStreamers } from "@/lib/collab";
import Anthropic from "@anthropic-ai/sdk";

// Generic Twitch categories that aren't real games — excluded from matching
const GENERIC_CATEGORIES = new Set([
  "just chatting", "pools, hot tubs & beaches", "talk shows & podcasts",
  "music", "art", "irl", "special events", "travel & outdoors",
  "sports", "asmr", "gambling",
]);

/** Use Claude Haiku to extract real game names from VOD titles. */
async function extractGameNames(titles: string[]): Promise<string[]> {
  if (titles.length === 0) return [];
  try {
    const anthropic = new Anthropic();
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 150,
      messages: [{
        role: "user",
        content: `Extract the specific VIDEO GAME titles being played from these Twitch stream titles. Return ONLY real game names like "Minecraft", "Valorant", "Elden Ring". Do NOT include "Just Chatting", "IRL", "Music", or other non-game categories. Return at most 4 unique game names as a JSON array. If no specific games are mentioned, return [].

Titles:
${titles.slice(0, 15).join("\n")}

JSON only: ["Game1", "Game2"]`,
      }],
    });
    const text = msg.content[0].type === "text" ? msg.content[0].text : "";
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.every((g) => typeof g === "string")) {
      // Filter out any generic categories that slipped through
      return parsed
        .filter((g: string) => !GENERIC_CATEGORIES.has(g.toLowerCase()))
        .slice(0, 4);
    }
  } catch (err) {
    console.warn("[collab/refresh] Game extraction failed:", err);
  }
  return [];
}

export async function POST(request: Request) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();

    // Build current user's profile
    const [profileRes, vodsRes, followerRes, burnoutRes] = await Promise.all([
      admin.from("profiles").select("twitch_display_name, twitch_avatar_url").eq("id", user.id).single(),
      admin.from("vods").select("title, peak_data, coach_report").eq("user_id", user.id).eq("status", "ready")
        .not("peak_data", "is", null).not("coach_report", "is", null).order("stream_date", { ascending: false }).limit(20),
      admin.from("follower_snapshots").select("follower_count").eq("user_id", user.id).eq("platform", "twitch")
        .order("snapped_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("burnout_snapshots").select("score").eq("user_id", user.id)
        .order("computed_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const vods = vodsRes.data || [];
    if (vods.length === 0) {
      return NextResponse.json({ error: "Analyze some VODs first to get collab matches." }, { status: 400 });
    }

    const userProfile = buildUserProfile(
      user.id,
      profileRes.data?.twitch_display_name || "Streamer",
      profileRes.data?.twitch_avatar_url || null,
      followerRes.data?.follower_count || 0,
      vods,
      burnoutRes.data?.score || 0,
    );

    // Get the user's collab preferences
    const { data: collabPref } = await admin.from("collab_profiles")
      .select("min_followers, max_followers, preferred_categories").eq("user_id", user.id).maybeSingle();

    const preferences = {
      minFollowers: collabPref?.min_followers || undefined,
      maxFollowers: collabPref?.max_followers || undefined,
      preferredCategories: collabPref?.preferred_categories || undefined,
    };

    // --- Internal matches: other opted-in LevlCast users ---
    const { data: otherUsers } = await admin.from("collab_profiles")
      .select("user_id").eq("enabled", true).neq("user_id", user.id);

    const otherUserIds = (otherUsers || []).map((u: any) => u.user_id);

    if (otherUserIds.length > 0) {
      const [otherProfilesRes, otherVodsRes, otherFollowersRes, otherBurnoutRes] = await Promise.all([
        admin.from("profiles").select("id, twitch_display_name, twitch_avatar_url").in("id", otherUserIds),
        admin.from("vods").select("user_id, peak_data, coach_report").in("user_id", otherUserIds)
          .eq("status", "ready").not("peak_data", "is", null).not("coach_report", "is", null),
        admin.from("follower_snapshots").select("user_id, follower_count").in("user_id", otherUserIds)
          .eq("platform", "twitch").order("snapped_at", { ascending: false }),
        admin.from("burnout_snapshots").select("user_id, score").in("user_id", otherUserIds)
          .order("computed_at", { ascending: false }),
      ]);

      const latestFollowers: Record<string, number> = {};
      for (const r of otherFollowersRes.data || []) {
        if (!latestFollowers[r.user_id]) latestFollowers[r.user_id] = r.follower_count;
      }
      const latestBurnout: Record<string, number> = {};
      for (const r of otherBurnoutRes.data || []) {
        if (!latestBurnout[r.user_id]) latestBurnout[r.user_id] = r.score;
      }
      const vodsByUser: Record<string, any[]> = {};
      for (const v of otherVodsRes.data || []) {
        if (!vodsByUser[v.user_id]) vodsByUser[v.user_id] = [];
        vodsByUser[v.user_id].push(v);
      }

      for (const p of otherProfilesRes.data || []) {
        const candidateVods = vodsByUser[p.id] || [];
        if (candidateVods.length === 0) continue;
        const candidateProfile = buildUserProfile(
          p.id, p.twitch_display_name || "Streamer", p.twitch_avatar_url,
          latestFollowers[p.id] || 0, candidateVods, latestBurnout[p.id] || 0,
        );
        const match = scoreMatch(userProfile, candidateProfile, preferences);
        if (!match) continue;

        await admin.from("collab_suggestions").delete().eq("user_id", user.id).eq("match_user_id", p.id);
        await admin.from("collab_suggestions").insert({
          user_id: user.id, match_user_id: p.id, match_score: match.score,
          reasons: match.reasons, is_external: false, status: "new",
          computed_at: new Date().toISOString(),
        });
      }
    }

    // --- External matches: live Twitch streamers in same games ---
    // Clear ALL old external suggestions first so stale results don't persist
    await admin.from("collab_suggestions")
      .delete()
      .eq("user_id", user.id)
      .eq("is_external", true);

    const titles = vods.map((v: any) => v.title).filter(Boolean);
    const gameNames = await extractGameNames(titles);
    console.log("[collab/refresh] VOD titles:", titles.slice(0, 5));
    console.log("[collab/refresh] Extracted game names:", gameNames);

    let externalCount = 0;
    try {
      const excludeIds: string[] = [];
      const externalMatches = await findExternalStreamers(userProfile, gameNames, excludeIds, 6);
      console.log("[collab/refresh] External matches found:", externalMatches.length);
      for (const em of externalMatches) {
        await admin.from("collab_suggestions").delete().eq("user_id", user.id).eq("twitch_id", em.streamer.twitchId);
        await admin.from("collab_suggestions").insert({
          user_id: user.id,
          match_user_id: null,
          twitch_id: em.streamer.twitchId,
          twitch_login: em.streamer.login,
          twitch_display_name: em.streamer.displayName,
          twitch_avatar_url: em.streamer.avatarUrl,
          follower_count: em.streamer.viewerCount || null,
          match_score: em.score,
          reasons: em.reasons,
          is_external: true,
          status: "new",
          computed_at: new Date().toISOString(),
        });
        externalCount++;
      }
    } catch (err) {
      console.warn("[collab/refresh] External matching failed:", err);
    }

    return NextResponse.json({ ok: true, debug: { titles: titles.slice(0, 5), gameNames, externalCount } });
  } catch (err) {
    console.error("[collab/refresh] Error:", err);
    return NextResponse.json({ error: "Failed to find matches" }, { status: 500 });
  }
}
