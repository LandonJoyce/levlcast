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
    max_tokens: 220,
    messages: [
      {
        role: "user",
        content: `Write a SHORT Reddit DM from someone who built LevlCast to a Twitch streamer who ${isComment ? "commented" : "posted"} asking for help.

${sourceDesc}
Username: ${authorName}

What LevlCast does, in order of importance:
1. PRIMARY: Coach report on every VOD. Scores the stream 0-100, names the exact moment viewers dropped off, tells you the one specific thing to fix next stream, tracks your score across streams so you can see real improvement.
2. SECONDARY: Auto-detects your best moments and cuts them as clips you can edit, caption, and post.

Lead with the coach report. The clip side is a bonus, not the main pitch.

Rules:
- First line: SUBJECT: <4-7 words, specific to their situation. No generic openers.>
- Then a blank line.
- Then the body: 2-3 short sentences. MAX 60 words total.
- Sentence 1: acknowledge their specific problem from the ${isComment ? "comment" : "post"} in one detail that proves you read it.
- Sentence 2: introduce the coach report and what it tells them, tied to their pain.
- Optional sentence 3: one line about the clips as a side benefit, or skip if it doesn't fit.
- End with "free to try at levlcast.com" or similar one-liner.
- ABSOLUTELY NO em dashes anywhere. Use periods or commas instead. If you would write a dash, rewrite the sentence.
- No corpo phrases. No "I hope", "just wanted to", "checking out", "might be worth", "would love to", "feel free".
- Sound like a streamer texting another streamer. Casual, blunt, real.
- Match their tone: frustrated = blunt, casual = casual, technical = specific numbers.
- Return ONLY the subject line and message. Nothing else.`,
      },
    ],
  });

  // Strip em dashes the model occasionally slips in despite the explicit
  // rule. ' — ' becomes '. ', bare '—' becomes a space.
  const stripEm = (s: string) => s.replace(/ — /g, ". ").replace(/—/g, " ");
  const raw = stripEm(msg.content[0].type === "text" ? msg.content[0].text.trim() : "");

  // Parse subject and message body
  const lines = raw.split("\n");
  let subject = isComment ? "Saw your comment" : "Saw your post";
  let message = raw;

  const subjectLine = lines.find((l) => l.toLowerCase().startsWith("subject:"));
  if (subjectLine) {
    subject = stripEm(subjectLine.replace(/^subject:\s*/i, "").trim());
    message = stripEm(
      lines
        .slice(lines.indexOf(subjectLine) + 1)
        .join("\n")
        .trim()
    );
  }

  return NextResponse.json({ message, subject });
}
