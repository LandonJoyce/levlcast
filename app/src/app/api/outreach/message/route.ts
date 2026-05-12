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

CRITICAL credibility rules (violating these gets the DM ignored or called out):
- You have NOT watched their stream. You have NOT seen any analytics. You ONLY have the post/comment text above. Never write anything that implies you have watched their stream, seen their VODs, or know their stats.
- BANNED openers and phrases: "noticed your stream", "I noticed", "I saw your stream", "your stream goes", "your VOD shows", "your numbers show", "your retention", "your dropoff", "watching your", "checked out your", "saw you're", "saw you were", "you're struggling", "you're worried", "you're frustrated", "sounds like you're", "seems like you're".
- BANNED specifics you cannot know: viewer counts, drop-off times, talk-time ratios, energy patterns, what their stream "goes deep on", how their viewers behave, what they are worried/frustrated/concerned about (unless they used those exact words). If they didn't say it in the post, you do not know it.
- The ONLY thing you can reference is the literal text of their post or comment. Quote a phrase or paraphrase what THEY wrote, not what you imagined about their channel.
- DO NOT infer their emotional state (worried, frustrated, struggling, etc.) unless they literally used that word themselves.

Format:
- First line: SUBJECT: <4-7 words, specific to what they actually wrote. No generic openers.>
- Then a blank line.
- Then the body: 2-3 short sentences. MAX 60 words total.
- Sentence 1: reference what THEY said in the ${isComment ? "comment" : "post"} (paraphrase or short quote). Prove you read THEIR words, not that you watched THEIR stream.
- Sentence 2: describe what the coach report would do for the exact problem they described. Hypothetical, not retrospective: "the report would tell you...", not "your report shows...".
- Optional sentence 3: one line about clips as a side benefit, or skip if it doesn't fit.
- End with "free to try at levlcast.com" or similar one-liner.
- ABSOLUTELY NO em dashes. Use periods or commas. If you would write a dash, rewrite the sentence.
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
