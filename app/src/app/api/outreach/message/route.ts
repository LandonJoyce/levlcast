import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const ADMIN_EMAIL = "landonjoyce@hotmail.com";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postTitle, postBody, authorName } = await req.json();
  if (!postTitle) return NextResponse.json({ error: "Missing post data" }, { status: 400 });

  const anthropic = new Anthropic();

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 250,
    messages: [
      {
        role: "user",
        content: `Write a short, personal Reddit DM to a Twitch streamer about LevlCast.

Their post:
Title: ${postTitle}
${postBody ? `Body: ${postBody}` : ""}
Username: ${authorName}

Rules:
- 3 sentences max. Short and genuine.
- Reference something specific from their post — don't be generic.
- Explain LevlCast in one sentence: it reads your VOD after a stream and tells you the exact moments where viewers left, with timestamps.
- Mention it's free to try. End with: levlcast.com
- No em dashes. No "I hope this message finds you well." No corpo language.
- Sound like a person, not a marketer. Conversational.
- Don't start with "Hey" if the post is serious/frustrated — match their tone.
- Return ONLY the message text. Nothing else.`,
      },
    ],
  });

  const message = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
  return NextResponse.json({ message });
}
