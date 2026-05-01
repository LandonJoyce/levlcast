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
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: `Write a short Reddit DM from someone who built LevlCast to a Twitch streamer who posted asking for help.

Their post:
Title: ${postTitle}
${postBody ? `Body: ${postBody}` : ""}
Username: ${authorName}

Rules:
- First line: SUBJECT: <a short subject line specific to their situation, 4-7 words, no generic phrases like "your stream" or "quick question", make it feel like it's written by a real person who read their post>
- Then a blank line
- Then the message body: 3 sentences max
- Reference something specific from their post
- Say you built LevlCast, not that you found it or that it's a tool you use
- Explain what it does in one sentence: it watches your VOD after each stream and shows you the exact timestamps where viewers dropped off
- Mention it's free. End with levlcast.com
- No em dashes. No hyphens between words. No corpo language. No "I hope". No "just wanted to".
- Sound like a real person texting, not a marketer
- Match their tone: if they're frustrated, be direct; if they're casual, be casual
- Return ONLY the subject line and message. Nothing else.`,
      },
    ],
  });

  const raw = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";

  // Parse subject and message body
  const lines = raw.split("\n");
  let subject = "Saw your post";
  let message = raw;

  const subjectLine = lines.find((l) => l.toLowerCase().startsWith("subject:"));
  if (subjectLine) {
    subject = subjectLine.replace(/^subject:\s*/i, "").trim();
    message = lines
      .slice(lines.indexOf(subjectLine) + 1)
      .join("\n")
      .trim();
  }

  return NextResponse.json({ message, subject });
}
