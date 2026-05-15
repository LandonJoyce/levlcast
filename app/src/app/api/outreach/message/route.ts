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
    max_tokens: 350,
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

SKIP RULES (be conservative — only skip for these specific reasons):
- The post is about a topic LevlCast cannot help with (ads/payouts, hardware, ToS, bans). Skip.
- The post body is "[removed]" or "[deleted]" AND the title is too short or generic to reference. Skip.
- Otherwise: DO NOT SKIP. A short title alone is still enough to reference. Even "Need help growing on Twitch" is a valid hook. Length is not a reason to skip.

When in doubt, WRITE the DM. The user's previous prompt was too strict — most posts in r/TwitchStreamers, r/SmallStreamers, etc. are valid targets. If the topic is broadly about streaming growth, retention, content quality, clips, or improvement, write the DM.

OPENER RULES (when writing):
- Preferred: open with a short direct quote from their text in quotation marks.
- If the post is too short or doesn't have a quotable phrase, open by referencing the topic they posted about WITHOUT inventing details ("saw your post about X" is fine, "saw you're worried about X" is NOT fine unless they used that exact word).
- NEVER fabricate emotional states, viewer counts, drop-off times, stats, or anything not in the text.`,
    messages: [
      {
        role: "user",
        content: `Decide if LevlCast is a fit for this streamer, then either SKIP or write the DM.

${sourceDesc}
Username: ${authorName}

LevlCast features:
1. Coach report on every VOD: scores 0-100, pinpoints when viewers left, gives one specific thing to fix, tracks improvement over time.
2. Auto-clips your best moments, you edit captions and post.

FOUNDING PRICE: $9.99/mo locks in forever if they subscribe before May 31. After that the price moves to $15/mo for new users. Include this as a one-line urgency hook in the message.

If SKIP, return only: "SKIP: <reason>"

If writing the DM, lead with the coach report and use this format:
- Line 1: SUBJECT: <4-7 words referencing what they wrote>
- Blank line
- Body: 2-4 sentences, MAX 75 words
  - Sentence 1: Open with a quote from their text (preferred) OR reference the topic they posted about. Connect it to LevlCast.
  - Sentence 2: what the coach report would do for their specific situation (hypothetical: "the report would..." not "your report shows...").
  - Sentence 3 (optional): clips as a bonus.
  - Final urgency line: "$9.99/mo founding price locks forever if you join before May 31, then it's $15."
- End with "try it at levlcast.com"

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
