/**
 * Reddit outreach: harvesting, filtering, deduplication and drafting.
 *
 * This module fills a queue. It does not send anything. Sending is a
 * separate, deliberately separate step so that every message can be read
 * before it goes out and so a bug here can never turn into a hundred DMs.
 *
 * The three things that keep this from being spam, in order of importance:
 *
 *  1. DEDUPLICATION IS PERMANENT. One row per Reddit account, ever, with a
 *     unique index behind it. Someone contacted once is never contacted
 *     again regardless of how often they post or how many subs they post
 *     in. Skipped people are recorded too, so the filter never reconsiders
 *     and re-drafts for someone already judged a bad fit.
 *
 *  2. RELEVANCE IS REQUIRED, NOT PREFERRED. A person has to be asking for
 *     the kind of help this product actually provides. The filters below
 *     reject far more than they accept, which is the correct ratio.
 *
 *  3. EVERY MESSAGE IS WRITTEN TO ITS PERSON. The draft quotes their own
 *     post and answers the thing they actually asked. A rotating angle
 *     stops consecutive messages reading as one template with the names
 *     swapped, which is both what makes outreach work and what stops it
 *     looking like a bot.
 */

import Anthropic from "@anthropic-ai/sdk";
import { OUTREACH_SUBS } from "@/lib/reddit";
import { createAdminClient } from "@/lib/supabase/server";

/** Help-seeking language. Mirrors the manual leads route. */
const HELP_PHRASES = [
  "my stream", "my channel", "i stream", "i've been streaming",
  "started streaming", "just started streaming", "new streamer", "new to streaming",
  "how do i grow", "how to grow", "can't grow", "struggling to grow",
  "no viewers", "low viewers", "0 viewers", "zero viewers",
  "how do i get", "how to get viewers", "how to get followers",
  "feedback on my", "feedback for my", "roast my", "rate my",
  "any advice", "any tips", "any help", "need advice", "need help",
  "what am i doing wrong", "what should i",
  "trying to reach affiliate", "trying to get affiliate", "path to affiliate",
];

/**
 * Subjects this product genuinely cannot help with. A message answering a
 * question about OBS settings or a DMCA strike with "try our VOD coach"
 * is the exact thing that gets reported as spam, and deserves to be.
 */
const OFF_TOPIC = [
  "obs", "streamlabs", "encoder", "bitrate", "dropped frames", "webcam",
  "microphone", "mic quality", "green screen", "capture card", "gpu", "cpu",
  "dmca", "copyright", "banned", "ban appeal", "suspended", "tos",
  "payout", "tax", "1099", "sub count money", "ad revenue",
  "hiring", "for hire", "commission", "logo", "overlay design", "emote artist",
];

/**
 * Rotating pitch angles. The draft prompt is told which one to take, so
 * consecutive messages differ in substance and not just wording. Each one
 * maps to something the product actually does.
 */
export const ANGLES = [
  {
    id: "retention",
    brief: "They do not know WHERE viewers leave. Lead with the fact that the report timestamps the exact minutes people dropped off, so they stop guessing.",
  },
  {
    id: "dead_air",
    brief: "Lead with dead air: the report measures how many minutes of a stream were silence and shows where, which is the most common invisible growth killer.",
  },
  {
    id: "clipping",
    brief: "Lead with time saved: it finds the clippable moments in a VOD and cuts them captioned, so they stop scrubbing hours of footage to find one clip.",
  },
  {
    id: "cold_open",
    brief: "Lead with the opening: most viewers decide in the first minutes, and the report scores the cold open specifically and says what to change.",
  },
  {
    id: "progress",
    brief: "Lead with tracking: it compares this stream to the last one and tells them whether the thing they were told to fix actually got fixed.",
  },
  {
    id: "rank",
    brief: "Lead with the rank. Every analysed stream moves you up or down a ladder from Iron to Grandmaster, there is a public leaderboard, and it turns 'am I getting better' into a number that moves. Do not oversell it as a game; the point is that progress becomes visible.",
  },
] as const;

export interface HarvestedLead {
  username: string;
  source: "post" | "comment";
  subreddit: string;
  permalink: string;
  title: string;
  body: string;
}

function hasAny(haystack: string, needles: string[]): boolean {
  return needles.some((n) => haystack.includes(n));
}

/**
 * Decide whether a lead is worth contacting at all.
 *
 * Deliberately strict. Rejecting a good lead costs nothing; contacting
 * someone who did not want to hear from us costs the account.
 */
export function judgeLead(lead: HarvestedLead): { ok: boolean; reason?: string } {
  const text = `${lead.title} ${lead.body}`.toLowerCase();
  const author = lead.username.toLowerCase();

  if (!author || author === "[deleted]" || author.includes("automoderator") || author.includes("bot")) {
    return { ok: false, reason: "bot or deleted author" };
  }
  if (text.length < 60) {
    return { ok: false, reason: "too short to personalise honestly" };
  }
  if (hasAny(text, OFF_TOPIC)) {
    return { ok: false, reason: "asking about something the product does not do" };
  }
  if (!hasAny(text, HELP_PHRASES)) {
    return { ok: false, reason: "not asking for help we can give" };
  }
  // Someone advertising a service is not a prospect.
  if (hasAny(text, ["dm me", "hire me", "my rates", "discord.gg/"])) {
    return { ok: false, reason: "self-promotion or recruiting" };
  }
  return { ok: true };
}

/**
 * Pull fresh posts from every worked subreddit in one request and return
 * anything that passes the filter AND has never been seen before.
 *
 * The dedup check happens here rather than at send time so we never spend
 * a Claude call drafting a message to someone already in the table.
 */
export async function harvestLeads(limit = 25): Promise<HarvestedLead[]> {
  const admin = createAdminClient();

  // Reddit's own API needs an OAuth app we do not have, and it blocks
  // credential-free reads from datacenter IPs. Arctic Shift is a public
  // Reddit mirror with no such restriction, and it is what this feature
  // ran on before it was switched to OAuth and broke.
  //
  // Measured against the live mirror: it returns posts minutes old, not
  // the multi-week lag its archive reputation suggests. A full pass over
  // all ten subs yields ~130 qualifying leads from 1000 posts, so the
  // constraint on this feature is send pacing, not supply.
  const rows = await Promise.all(
    OUTREACH_SUBS.map(async (sub) => {
      try {
        const res = await fetch(
          `https://arctic-shift.photon-reddit.com/api/posts/search?subreddit=${encodeURIComponent(sub)}&limit=100`,
          { headers: { "User-Agent": "LevlCast/1.0", Accept: "application/json" } }
        );
        if (!res.ok) return [] as Array<Record<string, unknown>>;
        const json = await res.json();
        return (json?.data ?? []) as Array<Record<string, unknown>>;
      } catch {
        // One dead subreddit must not take the whole harvest with it.
        return [] as Array<Record<string, unknown>>;
      }
    })
  );

  const children = rows.flat().map((d) => ({ data: d }));
  if (children.length === 0) return [];

  const candidates: HarvestedLead[] = [];
  for (const child of children) {
    const d = child.data ?? {};
    const username = String(d.author ?? "");
    const lead: HarvestedLead = {
      username,
      source: "post",
      subreddit: String(d.subreddit ?? ""),
      permalink: `https://reddit.com${String(d.permalink ?? "")}`,
      title: String(d.title ?? ""),
      body: String(d.selftext ?? "").slice(0, 1500),
    };
    const verdict = judgeLead(lead);
    if (!verdict.ok) continue;
    candidates.push(lead);
  }

  if (candidates.length === 0) return [];

  // One query for every candidate rather than one per candidate. Anyone
  // already in the table — queued, sent, skipped or failed — is out.
  const names = candidates.map((c) => c.username.toLowerCase());
  const { data: seen } = await admin
    .from("outreach_contacts")
    .select("reddit_username")
    .in("reddit_username", names);

  const seenSet = new Set(
    (seen ?? []).map((r: { reddit_username: string | null }) => String(r.reddit_username ?? ""))
  );
  const fresh = candidates.filter((c) => !seenSet.has(c.username.toLowerCase()));

  // De-dupe within this batch too: someone who posted twice in an hour
  // must not produce two rows and race the unique index.
  const batchSeen = new Set<string>();
  const unique = fresh.filter((c) => {
    const k = c.username.toLowerCase();
    if (batchSeen.has(k)) return false;
    batchSeen.add(k);
    return true;
  });

  return unique.slice(0, limit);
}

/**
 * Draft one message for one person, from their own words.
 *
 * Returns null when the model judges the lead a bad fit, which is treated
 * as a skip rather than an error: the model seeing the full text has more
 * context than the keyword filters and is allowed to overrule them.
 */
export async function draftMessage(
  lead: HarvestedLead,
  angle: (typeof ANGLES)[number]
): Promise<{ subject: string; body: string } | null> {
  const anthropic = new Anthropic();

  const res = await anthropic.messages.create({
    model: "claude-sonnet-5",
    // Generous because the reply is not the only thing counted: this model
    // can emit a thinking block first, and at 400 the budget ran out mid
    // thought and returned stop_reason "max_tokens" with no text at all.
    max_tokens: 1500,
    system: `You are answering a streamer on Reddit who asked for help. You know a tool called LevlCast that reads a Twitch VOD and reports where viewers dropped off, how much dead air there was, which moments are worth clipping, and whether the thing it told you to fix last stream actually got fixed.

You have ONE source of truth: the post text you are given. You cannot see their stream, their numbers, or their channel. Never imply you watched anything or looked anything up.

VOICE
You are one streamer replying to another, not a founder pitching. Answer the question they actually asked first, in your own words, and mention the tool as the thing that would show them the answer. If your message would still be useful with the tool removed from it, you have written it correctly.

HARD RULES
- Open by responding to the specific thing THEY said. Quote or paraphrase it so it is obvious this was written for them.
- Under 90 words.
- Plain sentences. No marketing voice, no exclamation marks, no emoji, no "hey there", no bulleted feature list.
- Do NOT sign your name, do NOT claim you built it, do NOT say "I made this" or "my tool". Never imply ownership.
- Mention the free tier once, accurately: two full reports every week, no card. Full means full, nothing is blurred or held back.
- Do not name a price. Do not say "trial".
- No pressure, no urgency, no follow-up promise, no question at the end fishing for a reply.

WHEN TO SKIP
Rarely. These posts have already been filtered for people asking about streaming growth, retention or content, so the default is to WRITE. Reply with exactly SKIP only when the post is about something this genuinely cannot help with — hardware, OBS, bitrate, bans, payouts, someone advertising a service — or when the text is empty or deleted. A short post is not a reason to skip. A vague post is not a reason to skip. Being unsure is not a reason to skip.

SUBJECT
Three to six words naming the topic they posted about, nothing more. It is a label, not a sentence and not a pitch. "Re your retention question" is right. "That early drop-off is fixable once you see it" is a sentence and is wrong.

ANGLE FOR THIS MESSAGE
${angle.brief}

Return JSON only: {"subject": "...", "body": "..."} or the single word SKIP.`,
    messages: [
      {
        role: "user",
        content: `Subreddit: r/${lead.subreddit}\nTitle: ${lead.title}\n\nBody:\n${lead.body || "(no body text)"}`,
      },
    ],
  });

  // Find the text block rather than assuming it is first. content[0] can be
  // a thinking block, in which case indexing position zero silently yields
  // an empty string and every lead is recorded as "model judged poor fit" —
  // a drafting failure that looks exactly like a filtering decision.
  const textBlock = res.content.find((b) => b.type === "text");
  const raw = textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";
  if (!raw || raw.toUpperCase().startsWith("SKIP")) return null;

  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as { subject?: string; body?: string };
    if (!parsed.subject || !parsed.body) return null;
    return { subject: parsed.subject.slice(0, 100), body: parsed.body };
  } catch {
    return null;
  }
}

/**
 * Harvest, draft and queue. Records skips as rows so the same person is
 * never evaluated twice.
 */
export async function fillOutreachQueue(
  max = 5,
  /**
   * Hard ceiling on Claude calls for this run, whatever the outcome.
   *
   * The loop used to break on `queued >= max`, which counts successes
   * only. A run where the model skipped every lead therefore never broke
   * early and drafted against all of harvestLeads(max * 3) — three times
   * the intended spend, on a run that queued nothing. In production that
   * was 18 calls an hour producing one usable message, which is paying
   * full price to be told no.
   *
   * Attempts are what cost money, so attempts are what is capped.
   */
  maxAttempts = max + 2
): Promise<{ queued: number; skipped: number; attempts: number }> {
  const admin = createAdminClient();
  const leads = await harvestLeads(maxAttempts);

  let queued = 0;
  let skipped = 0;
  let attempts = 0;

  const { count: contactedSoFar } = await admin
    .from("outreach_contacts")
    .select("id", { count: "exact", head: true });
  const angleSeed = contactedSoFar ?? 0;

  for (const lead of leads) {
    if (queued >= max || attempts >= maxAttempts) break;
    attempts++;

    // Rotate the angle so a run of messages does not all make the same
    // argument. Counted once before the loop, not once per lead: this was
    // a full count query per candidate, and it never changed often enough
    // to be worth re-reading mid-run.
    const angle = ANGLES[(angleSeed + attempts - 1) % ANGLES.length];

    let drafted: { subject: string; body: string } | null = null;
    try {
      drafted = await draftMessage(lead, angle);
    } catch (err) {
      console.warn("[outreach] draft failed:", err instanceof Error ? err.message : err);
      continue;
    }

    const row = {
      reddit_username: lead.username.toLowerCase(),
      source: lead.source,
      subreddit: lead.subreddit,
      permalink: lead.permalink,
      post_title: lead.title,
      post_excerpt: lead.body.slice(0, 600),
      angle: angle.id,
      ...(drafted
        ? { status: "queued", message_subject: drafted.subject, message_body: drafted.body }
        : { status: "skipped", skip_reason: "model judged poor fit" }),
    };

    // Unique index on reddit_username makes this safe against races: a
    // duplicate insert fails and is simply counted, never retried.
    const { error } = await admin.from("outreach_contacts").insert(row);
    if (error) continue;

    if (drafted) queued++;
    else skipped++;
  }

  return { queued, skipped, attempts };
}
