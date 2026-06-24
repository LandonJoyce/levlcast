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

PRICE: $14.99/mo or 2 free analyses to try with no card. Mention the free trial as the soft hook, not the paid price.

If SKIP, return only: "SKIP: <reason>"

If writing the DM, return ONLY a JSON object with this exact shape (no markdown, no commentary, no SUBJECT: prefix anywhere):

{
  "subject": "<4 to 7 words MAX about what they posted, NO quotes, NO sentences, NO punctuation other than letters and spaces, just a short topic label like 'Re viewer retention question' or 'Saw the affiliate post'>",
  "body": "<personalized DM as described below>"
}

Body rules (the JSON \"body\" value):
- Sentence 1 must open with a SHORT direct quote (3 to 8 words) in straight quotes from their post or comment, followed by a connection to LevlCast. The quote goes HERE, never in the subject.
- Sentence 2 says what the coach report would do for THEIR specific situation. Use hypothetical "would", not "does". Frame it as TWITCH VOD coaching explicitly — "coach report on your Twitch VODs", "your Twitch stream", or similar. Streamers should know this is for Twitch from one read.
- Optional sentence 3 only if clips add real value to their question.
- End with this exact final sentence on its own: 2 free analyses, no card. try it at levlcast.com
- 60 words MAX total (excluding the final CTA sentence).
- No dashes of any kind. No em, no en, no double hyphen, no single hyphen as a separator. Use periods, commas, or colons.
- No "I hope", "just wanted to", "might be worth", "would love to", "feel free to".
- Casual, blunt, like a streamer texting another streamer.

Subject rules (the JSON \"subject\" value):
- 4 to 7 words, hard cap.
- Refers to the TOPIC. Does not contain a quote, a pitch, or a sentence.
- Good: "Saw the affiliate post", "Question about viewer retention", "Re your stream growth post"
- Bad: anything over 7 words, anything with quotes, anything with a verb pitching the product.

Return ONLY the JSON object, OR a SKIP line.`,
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
  const raw = (msg.content[0].type === "text" ? msg.content[0].text.trim() : "");

  // Fit-check escape hatch — model decides not a fit and returns "SKIP: <reason>".
  if (/^skip\s*:/i.test(raw)) {
    const reason = raw.replace(/^skip\s*:\s*/i, "").trim() || "Not a fit for LevlCast";
    return NextResponse.json({ skip: true, reason });
  }

  // Parse the JSON the model returns. Sonnet occasionally wraps it in
  // ```json fences or adds a stray prefix; the regex below tolerates that
  // by grabbing the first balanced { ... } block in the response.
  let parsed: { subject?: string; body?: string } | null = null;
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      parsed = null;
    }
  }

  // Hard fallback if JSON parsing fails — use a sane subject + the raw text
  // as the body so the admin can still send something rather than seeing a
  // blank panel. They can always click "Write message" again.
  let subject = stripDashes((parsed?.subject ?? (isComment ? "Saw your comment" : "Saw your post")).trim());
  let body = stripDashes((parsed?.body ?? raw).trim());

  // Server-side guard rails. The prompt asks for these limits, but Sonnet
  // ignores them often enough that we enforce hard caps here. This is what
  // prevents the "paragraph in the title field" failure mode the admin kept
  // hitting — even if the model puts 30 words in subject, we trim to 7.
  const SUBJECT_MAX_WORDS = 7;
  const subjectWords = subject.split(/\s+/).filter(Boolean);
  if (subjectWords.length > SUBJECT_MAX_WORDS) {
    subject = subjectWords.slice(0, SUBJECT_MAX_WORDS).join(" ");
  }
  // Strip any quotes the model wrapped the subject in.
  subject = subject.replace(/^["'`]+|["'`]+$/g, "").trim();

  // Hard-append the CTA + link if the model dropped it. Sonnet sometimes
  // generates the personalized body fine but skips the final CTA sentence,
  // which leaves outreach DMs with no link to levlcast.com — the entire
  // point of the message. Detect by case-insensitive substring match so
  // any variant ("LevlCast.com", "LevLcast.com") still counts as present.
  const CTA_LINE = "2 free analyses, no card. try it at levlcast.com";
  if (!/levlcast\.com/i.test(body)) {
    body = `${body.trim().replace(/\.?\s*$/, ".")}\n\n${CTA_LINE}`;
  }

  return NextResponse.json({ message: body, subject });
}
