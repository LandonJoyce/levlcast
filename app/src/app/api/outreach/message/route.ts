import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const ADMIN_EMAIL = "landonjoyce@hotmail.com";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postTitle, postBody, authorName, context } = await req.json() as {
    postTitle?: string;
    postBody?: string;
    authorName: string;
    context?: "post" | "comment";
  };
  const isComment = context === "comment";
  if (!isComment && !postTitle) return NextResponse.json({ error: "Missing post data" }, { status: 400 });
  if (isComment && !postBody) return NextResponse.json({ error: "Missing comment body" }, { status: 400 });

  const anthropic = new Anthropic();

  const sourceDesc = isComment
    ? `Their comment in a streaming subreddit:\n${postBody}`
    : `Their post:\nTitle: ${postTitle}\n${postBody ? `Body: ${postBody}` : ""}`;

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: `Write a short Reddit DM from someone who built LevlCast to a Twitch streamer who ${isComment ? "commented" : "posted"} asking for help.

${sourceDesc}
Username: ${authorName}

What LevlCast does (pick the 1-2 most relevant to their pain point):
- Analyzes your VOD after each stream, scores it 0-100, and tells you the specific things to fix to improve
- Auto-detects your best moments and generates clips ready to post as YouTube Shorts or TikTok without you rewatching anything
- Shows the exact timestamps where viewers dropped off so you know what killed retention
- Tracks your coaching score across streams so you can see if you're actually getting better

Rules:
- First line: SUBJECT: <4-7 words, specific to their situation, written like a real person who actually read their ${isComment ? "comment" : "post"}, no generic openers>
- Then a blank line
- Then the message body: 3 sentences max
- Sentence 1: acknowledge their specific problem from the ${isComment ? "comment" : "post"} (1 detail that proves you read it)
- Sentence 2: say you built LevlCast, describe what it does using the features most relevant to their pain (1 sentence)
- Sentence 3: tell them it's free to try, end with levlcast.com
- No em dashes. No hyphens between words. No corpo language. No "I hope". No "just wanted to". No "checking out". No "might be worth".
- Sound like a person who actually uses the product and built it, not a marketer
- Match their tone exactly: if they're frustrated, be blunt; if they're casual, be casual; if they're technical, be specific
- Return ONLY the subject line and message. Nothing else.`,
      },
    ],
  });

  const raw = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";

  // Parse subject and message body
  const lines = raw.split("\n");
  let subject = isComment ? "Saw your comment" : "Saw your post";
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
