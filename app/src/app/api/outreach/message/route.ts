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
    max_tokens: 300,
    system: `You write cold Reddit DMs for LevlCast. You have ONE source of truth: the post or comment text provided. You cannot see the stream, the VODs, the analytics, or anything else. If it is not in the text, you do not know it.

LevlCast helps streamers with these specific problems:
- Not knowing why viewers leave (the coach report pinpoints retention drop-offs)
- Not knowing what to fix to grow (specific stream-by-stream coaching)
- Spending hours clipping (auto-detects best moments and cuts them)
- Wanting to track improvement over time

LevlCast does NOT help with:
- Ad/sub/bits revenue mechanics (we don't change Twitch payouts)
- Equipment, hardware, internet, OBS settings
- Getting verified, partner application logistics
- Twitch terms of service / bans / DMCA
- Pure venting that isn't asking for advice

STEP 1: Decide if LevlCast genuinely helps with what this person posted.
- If yes, write the DM following the format below.
- If no, return ONLY the string "SKIP: <one short reason why this isn't a fit>" and nothing else.

Do not force a connection. A forced pitch hurts more than not sending. When in doubt, SKIP.

HARD RULE (when writing): The first sentence must open with a SHORT DIRECT QUOTE from their post or comment — their exact words in quotation marks. Not a paraphrase. Not a topic summary. Their actual words.`,
    messages: [
      {
        role: "user",
        content: `Decide if LevlCast is a fit for this streamer, then either SKIP or write the DM.

${sourceDesc}
Username: ${authorName}

LevlCast features:
1. Coach report on every VOD: scores 0-100, pinpoints when viewers left, gives one specific thing to fix, tracks improvement over time.
2. Auto-clips your best moments, you edit captions and post.

If SKIP, return only: "SKIP: <reason>"

If writing the DM, lead with the coach report and use this format:
- Line 1: SUBJECT: <4-7 words taken from or directly referencing what they wrote>
- Blank line
- Body: 2-3 sentences, MAX 60 words
  - Sentence 1: MUST open with a direct quote from their text in quotation marks, then connect it to LevlCast
  - Sentence 2: what the coach report would do for their specific situation (hypothetical: "the report would..." not "your report shows...")
  - Sentence 3 (optional): clips as a bonus
- Final line: "free to try at levlcast.com"

No em dashes. No "I hope", "just wanted to", "might be worth", "would love to". Casual, blunt, like a streamer texting another streamer. Return ONLY the subject and message, OR the SKIP line.`,
      },
    ],
  });

  // Strip em dashes the model occasionally slips in despite the explicit
  // rule. ' — ' becomes '. ', bare '—' becomes a space.
  const stripEm = (s: string) => s.replace(/ — /g, ". ").replace(/—/g, " ");
  const raw = stripEm(msg.content[0].type === "text" ? msg.content[0].text.trim() : "");

  // Fit-check escape hatch. If the model decides LevlCast isn't a fit it
  // returns "SKIP: <reason>" and we surface that to the admin so they can
  // skip the lead instead of sending a forced reply.
  if (/^skip\s*:/i.test(raw)) {
    const reason = raw.replace(/^skip\s*:\s*/i, "").trim() || "Not a fit for LevlCast";
    return NextResponse.json({ skip: true, reason });
  }

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
