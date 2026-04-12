import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Pro gate
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, subscription_expires_at")
    .eq("id", user.id)
    .single();

  const isExpired =
    profile?.plan === "pro" &&
    profile?.subscription_expires_at &&
    new Date(profile.subscription_expires_at) < new Date();

  const isPro = profile?.plan === "pro" && !isExpired;
  if (!isPro) {
    return NextResponse.json({ error: "pro_required" }, { status: 403 });
  }

  const { selectedContent, dayPerformance, streamerIdentity } = await req.json();

  if (!selectedContent?.length) {
    return NextResponse.json({ error: "no_content_selected" }, { status: 400 });
  }

  const anthropic = new Anthropic();

  const dayLines = Object.entries(
    dayPerformance as Record<string, { avgScore: number; count: number }>
  )
    .sort(([, a], [, b]) => b.avgScore - a.avgScore)
    .map(
      ([day, data]) =>
        `${day}: avg score ${Math.round(data.avgScore)}/100 (${data.count} stream${data.count !== 1 ? "s" : ""})`
    )
    .join("\n");

  const prompt = `You are a Twitch growth strategist building a stream plan for a real streamer.

STREAMER PROFILE:
- Type: ${streamerIdentity.streamerType || "variety"}
- Dominant peak category: ${streamerIdentity.dominantCategory || "hype"}
- Total analyzed streams: ${streamerIdentity.totalStreams}

HISTORICAL PERFORMANCE BY DAY (avg coaching score out of 100, higher = better stream quality):
${dayLines || "No data yet"}

CONTENT THEY PLAN TO STREAM:
${(selectedContent as string[]).join(", ")}

TASK:

1. SCHEDULE — recommend 2-3 days to stream:
- If day data exists: rank by avg score (highest score = best day). Pick the top 2-3.
- If scores are similar or all low: pick by stream count (consistency matters). Be honest about the scores — don't spin a low score as a good sign.
- Suggest a start time (7-9 PM ET is peak for most streamers unless data says otherwise)
- Reason: max 12 words, state the actual numbers plainly. Example: "Avg 62 on Thursdays — your best scoring day by far." Not: "Thursday provides a strong foundation..."
- If scores are universally low (below 50), say so plainly: "Scores are low across all days — focus on quality over schedule."

2. TITLE SUGGESTIONS — 3 titles per content item:
- Match personality: hype streamer = energy-first, educational = insight-first, funny = personality-driven
- 40-70 characters, no hashtags, no "Let's Play", no quotes around game names
- Sound like something a real streamer would actually say, not a YouTube thumbnail

No emojis. No filler. State numbers plainly.

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "schedule": [
    { "day": "<day>", "time": "<H:MM AM/PM ET>", "reason": "<max 12 words, plain numbers>" }
  ],
  "titles": [
    {
      "content": "<exact content item from input>",
      "suggestions": ["<title 1>", "<title 2>", "<title 3>"]
    }
  ]
}`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    system:
      "You are a Twitch growth strategist who gives specific, data-driven stream planning advice. Direct and practical — no fluff.",
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const cleaned = text
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();
    const plan = JSON.parse(cleaned);
    return NextResponse.json(plan);
  } catch {
    console.error("[planner] Failed to parse plan response:", text);
    return NextResponse.json({ error: "parse_failed" }, { status: 500 });
  }
}
