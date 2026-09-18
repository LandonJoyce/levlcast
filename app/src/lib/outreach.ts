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
import { redditGet, OUTREACH_SUBS } from "@/lib/reddit";
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
  const path = `/r/${OUTREACH_SUBS.join("+")}/new?limit=100`;
  const json = await redditGet(path);
  const children: Array<{ data?: Record<string, unknown> }> = json?.data?.children ?? [];

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
    max_tokens: 400,
    system: `You write one-to-one Reddit messages for LevlCast, a tool that reads a streamer's Twitch VOD and tells them what to fix: where viewers dropped off, how much dead air there was, which moments are worth clipping, and whether last week's problem got fixed.

You have ONE source of truth: the post text you are given. You cannot see their stream, their numbers, or their channel. Never imply you watched anything or looked anything up.

HARD RULES
- Open by responding to the specific thing THEY said. Quote or paraphrase it so it is obvious this was written for them.
- Under 90 words. Short enough to read in a glance.
- Plain sentences. No marketing voice, no exclamation marks, no emoji, no "hey there!", no bulleted feature list.
- Mention the free no-account report once: they can paste a VOD link at levlcast.com and read a report without signing up.
- No pressure, no urgency, no follow-up promise.
- Sign off as Landon, who built it.
- If this person is NOT a good fit, or the post gives you nothing specific to respond to, reply with exactly: SKIP

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

  const raw = res.content[0]?.type === "text" ? res.content[0].text.trim() : "";
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
export async function fillOutreachQueue(max = 5): Promise<{ queued: number; skipped: number }> {
  const admin = createAdminClient();
  const leads = await harvestLeads(max * 3);

  let queued = 0;
  let skipped = 0;

  for (const lead of leads) {
    if (queued >= max) break;

    // Rotate the angle by how many have been queued so far, so a run of
    // messages does not all make the same argument.
    const { count } = await admin
      .from("outreach_contacts")
      .select("id", { count: "exact", head: true });
    const angle = ANGLES[(count ?? 0) % ANGLES.length];

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

  return { queued, skipped };
}
