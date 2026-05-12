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
    model: "claude-sonnet-4-6",
    max_tokens: 220,
    system: `You write cold Reddit DMs for LevlCast. You have ONE source of truth: the post or comment text provided. You cannot see the stream, the VODs, the analytics, or anything else. If it is not in the text, you do not know it.

HARD RULE: Your first sentence must open with a SHORT DIRECT QUOTE from their post or comment — their exact words in quotation marks. Not a paraphrase. Not a topic summary. Their actual words. If their post is a title only, quote the title or a phrase from it.

This quote-first rule exists because past DMs fabricated things like "saw you're worried about keeping people watching" when the person never said that. That destroys credibility instantly.`,
    messages: [
      {
        role: "user",
        content: `Write a Reddit DM from the person who built LevlCast to a streamer who ${isComment ? "wrote this comment" : "wrote this post"}.

${sourceDesc}
Username: ${authorName}

LevlCast:
1. Coach report on every VOD: scores 0-100, pinpoints when viewers left, gives one specific thing to fix, tracks improvement over time.
2. Auto-clips your best moments, you edit captions and post.

Lead with the coach report.

Format:
- Line 1: SUBJECT: <4-7 words taken from or directly referencing what they wrote>
- Blank line
- Body: 2-3 sentences, MAX 60 words
  - Sentence 1: MUST open with a direct quote from their text in quotation marks, then connect it to LevlCast
  - Sentence 2: what the coach report would do for their specific situation (hypothetical: "the report would..." not "your report shows...")
  - Sentence 3 (optional): clips as a bonus
- Final line: "free to try at levlcast.com"

No em dashes. No "I hope", "just wanted to", "might be worth", "would love to". Casual, blunt, like a streamer texting another streamer. Return ONLY the subject and message.`,
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
