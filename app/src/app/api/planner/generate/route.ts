import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

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

  const { selectedContent, streamerIdentity } = await req.json();

  if (!selectedContent?.length) {
    return NextResponse.json(
      { error: "no_content_selected" },
      { status: 400 }
    );
  }

  const anthropic = new Anthropic();

  const prompt = `Generate stream title ideas for a Twitch streamer.

STREAMER PROFILE:
- Type: ${streamerIdentity.streamerType || "variety"}
- Dominant peak category: ${streamerIdentity.dominantCategory || "hype"}
- Total analyzed streams: ${streamerIdentity.totalStreams}

CONTENT THEY PLAN TO STREAM:
${(selectedContent as string[]).join(", ")}

For each content item, give exactly 3 title options.

TITLE RULES:
- Match the streamer's personality: hype streamers need energy-first titles, educational streamers need insight-first titles, funny streamers need personality-driven titles
- 40-70 characters each
- No hashtags, no "Let's Play", no quotes around game names, no exclamation marks at the end
- Sound like something a real streamer would actually type as their stream title — not a YouTube thumbnail or clickbait
- Each title should have a different angle: one confident, one playful, one specific to the content

No emojis. No filler.

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "titles": [
    {
      "content": "<exact content item from input>",
      "suggestions": ["<title 1>", "<title 2>", "<title 3>"]
    }
  ]
}`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    system:
      "You write Twitch stream titles that sound natural and match each streamer's personality. Direct and specific — never generic.",
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const cleaned = text
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();
    const result = JSON.parse(cleaned);
    return NextResponse.json(result);
  } catch {
    console.error("[planner] Failed to parse title response:", text);
    return NextResponse.json({ error: "parse_failed" }, { status: 500 });
  }
}
