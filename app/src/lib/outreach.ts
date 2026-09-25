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
 *
 * And one rule about honesty: messages go out from Landon's account and
 * say, once and plainly, that he made the tool. An earlier version had the
 * model write as a random streamer who merely uses it. Undisclosed
 * self-promotion is what gets DMs reported and accounts banned on Reddit,
 * and it made a message sound less like Landon, not more. What stops a
 * message reading as a founder pitch is the tone (help first, casual, no
 * selling), not hiding who's sending it.
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
 * Rotating angles: which one thing the message says the tool would show
 * them. Consecutive messages then differ in substance and not just
 * wording. Each one maps to something the product actually does.
 */
export const ANGLES = [
  {
    id: "retention",
    brief: "it shows the exact minutes in their VOD where people dropped off, so they stop guessing why viewers leave.",
  },
  {
    id: "dead_air",
    brief: "it measures how much of their stream was dead air and shows where the quiet stretches were.",
  },
  {
    id: "clipping",
    brief: "it finds the best moments in a VOD and cuts them into clips with captions, so they don't have to scrub through hours of footage.",
  },
  {
    id: "cold_open",
    brief: "it looks at how their stream opens, since most people decide whether to stay in the first few minutes, and tells them what to change.",
  },
  {
    id: "progress",
    brief: "it compares each stream to the last one and tells them whether the thing they were working on actually got better.",
  },
  {
    id: "rank",
    brief: "every stream they analyze moves them up or down a rank from Iron to Grandmaster, with a weekly league against streamers at their level, so they can actually see if they're improving. Don't oversell it as a game.",
  },
] as const;

export type Angle = (typeof ANGLES)[number];

/** Stable angle for a one-off draft (the manual paste flow), picked from the username. */
export function angleFor(seed: string): Angle {
  let hash = 0;
  for (const ch of seed.toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return ANGLES[hash % ANGLES.length];
}

/**
 * Where every message sends people: the free analyzer, where they can
 * paste a VOD with no account. Written out in full because Reddit only
 * turns a link into something clickable when it starts with https:// or
 * www. The old manual drafts ended in a bare "levlcast.com", which
 * rendered as plain text nobody could click.
 */
export const OUTREACH_LINK = "https://www.levlcast.com/analyze";

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

/** What a draft is written from: one person's post or comment. */
export interface DraftInput {
  username: string;
  source: "post" | "comment";
  subreddit?: string | null;
  title?: string | null;
  body?: string | null;
}

/**
 * A draft, a skip (the model read it and judged it a bad fit), or a
 * failure (truncated, refused, unparseable). Skip and failure are kept
 * apart on purpose: a skip is recorded so the person is never reconsidered,
 * a failure is not, so the lead can be tried again later.
 */
export type DraftResult =
  | { kind: "draft"; subject: string; body: string }
  | { kind: "skip"; reason: string }
  | { kind: "failed"; reason: string };

/**
 * The drafting prompt, in Landon's voice.
 *
 * The examples under "how Landon types" are real messages he sent, because
 * describing a voice ("casual, like texting") gets a model's idea of casual,
 * which is still tidier and more symmetrical than a person typing on a
 * phone. Shown the real thing, it writes closer to it.
 */
function systemPrompt(angle: Angle): string {
  return `You're Landon. You stream on Twitch and you built LevlCast, a site where you paste a Twitch VOD and it tells you what happened in the stream: where people dropped off, how much dead air there was, which moments are worth clipping, and it ranks you from Iron to Grandmaster so you can see if you're getting better.

You're sending a Reddit message to a streamer who posted asking for help. You only know what's in their post. You haven't watched their stream or looked at their channel, so never say or imply you did, and never make up numbers or details they didn't write.

HOW LANDON TYPES
Like he's texting a friend on his phone. Casual, simple words, contractions, short sentences, a little run-on is fine, starting a sentence lowercase is fine. Real messages he's typed:
"Awesome! Sorry for forgetting! I hope it proved useful to you."
"I did a recent update for it including ranks and a bit of an update to how it works so I been putting it back out there lol"
"thats awesome super proud of that I hope I helped in some ways!"
It should read like one person typed it in a minute, not like something written and edited.

WHAT TO WRITE, IN THIS ORDER
1. React to what they actually said, in your own words, so it's obvious you read their post.
2. One real tip that helps with what they asked. It has to be useful even if they never click anything.
3. Say plainly that you made a tool for this (for example "I actually made a free site for this" or "I built a thing that does this"), and what it would show them: ${angle.brief}
4. The link on its own line, exactly: ${OUTREACH_LINK}
5. That it's free to try and they don't need an account.

RULES
- 45 to 90 words.
- The link appears once, written exactly as above so it's clickable. Never write levlcast.com any other way.
- No dashes of any kind (no em dash, no en dash, no double hyphen). Use commas and periods.
- Nothing that sounds like an ad or a template: no "Hey there", "just wanted to reach out", "I came across your post", "feel free to", "game changer", "level up", "take your stream to the next level", no lists, no bold, no emoji, no hashtags.
- At most one exclamation mark.
- Don't sign your name, Reddit already shows who it's from.
- No prices, no "trial", no pressure, and don't end by asking them to reply.

WHEN TO SKIP
Rarely. These have already been filtered for people asking about growing, keeping viewers, or their content, so the default is to write. Skip only if it's about something this can't help with (hardware, OBS, bitrate, bans, payouts), someone advertising their own service, or the text is deleted or empty. Short or vague is not a reason to skip.

OUTPUT
Return only JSON: {"subject": "...", "body": "..."}
The subject is 2 to 6 casual words about their post, like "your post about viewers" or "re: growing on twitch". A label, not a pitch.
If you skip, return only: SKIP: <short reason>`;
}

/**
 * Draft one message for one person, from their own words.
 *
 * A skip is the model overruling the keyword filters, which it's allowed to
 * do: it sees the whole text, the filters only see keywords.
 */
export async function draftMessage(input: DraftInput, angle: Angle): Promise<DraftResult> {
  const anthropic = new Anthropic();

  const lines = [
    input.subreddit ? `Subreddit: r/${input.subreddit}` : null,
    `Their username: ${input.username}`,
    input.source === "comment" ? "They left this comment:" : "They posted this:",
    input.title ? `Title: ${input.title}` : null,
    input.body ? input.body : input.source === "post" ? "(no body text)" : null,
  ].filter(Boolean);

  const res = await anthropic.messages.create({
    model: "claude-sonnet-5",
    // Headroom for the thinking this model does before it writes. At 400,
    // and later 1500, the budget could run out mid-thought and leave no
    // message at all; a ceiling only costs what's actually used.
    max_tokens: 8000,
    system: systemPrompt(angle),
    messages: [{ role: "user", content: lines.join("\n") }],
  });

  // A cut-off or refused reply is a failed draft, not a judgement about the
  // person. Treating it as a skip would permanently drop a good lead.
  if (res.stop_reason === "max_tokens") return { kind: "failed", reason: "ran out of room before finishing" };
  // "refusal" postdates the installed SDK's types, but the API does send it.
  if ((res.stop_reason as string | null) === "refusal") return { kind: "failed", reason: "declined to write it" };

  // Find the text block rather than assuming it is first. content[0] can be
  // a thinking block, in which case indexing position zero silently yields
  // an empty string and a drafting failure looks like a filtering decision.
  const textBlock = res.content.find((b) => b.type === "text");
  const raw = textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";
  if (!raw) return { kind: "failed", reason: "empty reply" };

  if (/^skip\b/i.test(raw)) {
    return { kind: "skip", reason: raw.replace(/^skip\s*:?\s*/i, "").trim() || "not a fit" };
  }

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { kind: "failed", reason: "no JSON in the reply" };
  try {
    const parsed = JSON.parse(match[0]) as { subject?: string; body?: string };
    if (!parsed.body) return { kind: "failed", reason: "no message body" };
    return { kind: "draft", ...finishDraft(parsed.subject ?? "", parsed.body) };
  } catch {
    return { kind: "failed", reason: "unreadable JSON" };
  }
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Enforce in code what the prompt asks for, because the model follows the
 * prompt most of the time rather than every time:
 *  - no dashes (the fastest tell that a model wrote it),
 *  - every way of writing the site becomes the one clickable link,
 *  - the link appears exactly once, added on its own line if it's missing,
 *  - the subject stays a short label.
 */
export function finishDraft(subject: string, body: string): { subject: string; body: string } {
  const stripDashes = (s: string) =>
    s
      .replace(/\s+(?:—|–|--)\s+/g, ", ")
      .replace(/—|–|--/g, " ");

  let text = stripDashes(body);

  // levlcast.com, www.levlcast.com/analyze, http://levlcast.com/... all
  // become the one link. Trailing punctuation stays outside the match, and
  // the lookbehind leaves an email address like landon@levlcast.com alone.
  text = text.replace(/(?<![@\w.])(?:https?:\/\/)?(?:www\.)?levlcast\.com(?:\/[^\s)]*[^\s).,!?])?/gi, OUTREACH_LINK);

  // Keep the first link, drop any repeats.
  let seen = false;
  text = text.replace(new RegExp(escapeRegExp(OUTREACH_LINK), "g"), (m) => {
    if (seen) return "";
    seen = true;
    return m;
  });
  if (!seen) text = `${text.trimEnd()}\n\n${OUTREACH_LINK}`;

  // The link always sits on its own line, so it's the obvious thing to tap
  // and never runs into the next sentence. The model mostly drops it
  // mid-paragraph ("...why. https://... it's free to try"), prompt or not.
  text = text.replace(
    new RegExp(`[ \\t]*${escapeRegExp(OUTREACH_LINK)}[.,!?;:]?[ \\t]*`),
    `\n\n${OUTREACH_LINK}\n\n`
  );

  text = text
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  let label = stripDashes(subject).replace(/^["'`]+|["'`]+$/g, "").trim();
  const words = label.split(/\s+/).filter(Boolean);
  if (words.length > 7) label = words.slice(0, 7).join(" ");

  return { subject: label || "saw your post", body: text };
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

    let drafted: DraftResult;
    try {
      drafted = await draftMessage(lead, angle);
    } catch (err) {
      console.warn("[outreach] draft failed:", err instanceof Error ? err.message : err);
      continue;
    }
    // A failed draft leaves no row, so the lead can be tried again on a
    // later run. Only a real skip is recorded as a decision.
    if (drafted.kind === "failed") {
      console.warn(`[outreach] draft failed for ${lead.username}: ${drafted.reason}`);
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
      ...(drafted.kind === "draft"
        ? { status: "queued", message_subject: drafted.subject, message_body: drafted.body }
        : { status: "skipped", skip_reason: `model: ${drafted.reason}`.slice(0, 200) }),
    };

    // Unique index on reddit_username makes this safe against races: a
    // duplicate insert fails and is simply counted, never retried.
    const { error } = await admin.from("outreach_contacts").insert(row);
    if (error) continue;

    if (drafted.kind === "draft") queued++;
    else skipped++;
  }

  return { queued, skipped, attempts };
}
