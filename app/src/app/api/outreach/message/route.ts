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

PRICE: $14.99/mo or 3 free analyses to try with no card. Mention the free trial as the soft hook, not the paid price.

If SKIP, return only: "SKIP: <reason>"

If writing the DM, output EXACTLY this shape (no markdown, no extra commentary):

SUBJECT: <4 to 7 words about what they posted>

<body sentence one referencing their exact topic and connecting to LevlCast>
<body sentence two on what the report would do for their situation, hypothetical "would" not "does">
<optional sentence three on clips, only if it adds value>

3 free analyses, no card. try it at levlcast.com

Hard rules for the body:
- 2 or 3 sentences total, 45 words MAX (excluding the CTA line)
- No dashes of any kind: no em (—), no en (–), no double hyphen (--), no single hyphen as a separator. Use periods, commas, or colons.
- No "I hope", "just wanted to", "might be worth", "would love to", "feel free to"
- Casual, blunt, like a streamer texting another streamer
- The SUBJECT line stays short. The body goes on its own lines BELOW the subject. Never put body content into the SUBJECT line.

Return ONLY the formatted output above, OR a SKIP line.`,
      },
    ],
  });

  // Strip every dash variant the model might slip in despite the prompt rule.
  // Sequence matters: longer/spaced patterns first, then bare characters.
  //   ' — ' / ' – ' / ' -- ' / ' - '  -> '. '   (sentence break)
  //   bare '—' / '–' / '--'           -> ' '    (avoid double space awareness; collapse later)
  // Final pass collapses any accidental double spaces.
  const stripDashes = (s: string) =>
    s
      .replace(/\s+(?:—|–|--|- )\s+/g, ". ")
      .replace(/—|–|--/g, " ")
      .replace(/\s{2,}/g, " ");
  const raw = stripDashes(msg.content[0].type === "text" ? msg.content[0].text.trim() : "");

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
    const rawSubject = stripDashes(subjectLine.replace(/^subject:\s*/i, "").trim());
    let restAfterSubject = stripDashes(
      lines
        .slice(lines.indexOf(subjectLine) + 1)
        .join("\n")
        .trim()
    );

    // Defense: the model occasionally collapses body into the SUBJECT line
    // ("SUBJECT: short hook full pitch sentence two CTA…"). Anything longer
    // than ~12 words clearly isn't a real subject — take the first sentence
    // as the subject and shove the rest into the message body so the user
    // never sees a paragraph in the title field.
    const subjectWordCount = rawSubject.split(/\s+/).filter(Boolean).length;
    if (subjectWordCount > 12) {
      const firstSentenceEnd = rawSubject.search(/[.!?](\s|$)/);
      if (firstSentenceEnd > 0) {
        subject = rawSubject.slice(0, firstSentenceEnd).trim();
        const overflow = rawSubject.slice(firstSentenceEnd + 1).trim();
        restAfterSubject = overflow
          ? `${overflow}\n\n${restAfterSubject}`.trim()
          : restAfterSubject;
      } else {
        // No sentence boundary — fall back to first ~7 words as subject.
        const words = rawSubject.split(/\s+/);
        subject = words.slice(0, 7).join(" ");
        const overflow = words.slice(7).join(" ");
        restAfterSubject = overflow
          ? `${overflow}\n\n${restAfterSubject}`.trim()
          : restAfterSubject;
      }
    } else {
      subject = rawSubject;
    }

    message = restAfterSubject;
  }

  return NextResponse.json({ message, subject });
}
