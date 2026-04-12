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

  const prompt = `You are a Twitch growth strategist building a personalized stream plan for a real streamer.

STREAMER PROFILE:
- Type: ${streamerIdentity.streamerType || "variety"}
- Dominant peak category: ${streamerIdentity.dominantCategory || "hype"}
- Total analyzed streams: ${streamerIdentity.totalStreams}

HISTORICAL PERFORMANCE BY DAY:
${dayLines || "Not enough data — base recommendations on typical Twitch peak times"}

CONTENT THEY PLAN TO STREAM THIS WEEK:
${(selectedContent as string[]).join(", ")}

TASK:
Generate a practical weekly stream plan tailored to this streamer.

1. SCHEDULE (2-3 recommended days):
- Pick their best-performing days from the data above
- Suggest a specific start time based on typical Twitch peak hours for their content type
- One-line reason grounded in THEIR data, not generic advice
- If no day data exists, recommend Tuesday/Thursday/Saturday 7-9 PM ET

2. TITLE SUGGESTIONS (for each content item):
- Give exactly 3 title options per content item
- Match the personality style: a hype streamer needs energy-first titles, an educational streamer needs insight-first titles, a funny streamer needs personality-driven titles
- Titles: 40-70 characters, no hashtags, no "Let's Play", no quotes around game names, no filler
- Make them feel like something THIS specific streamer would say — not generic YouTube titles

No emojis. No padding. Be direct.

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "schedule": [
    { "day": "<day name>", "time": "<H:MM AM/PM ET>", "reason": "<one sentence, specific to their data>" }
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
