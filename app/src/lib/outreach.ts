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
import { OUTREACH_SUBS, arcticShiftGet } from "@/lib/reddit";
import { createAdminClient } from "@/lib/supabase/server";
import { inngest } from "@/lib/inngest/client";
import { extractChannel } from "@/lib/twitch-input";
import {
  fetchPreviewVodMeta,
  latestVodForChannel,
  MIN_PREVIEW_SECONDS,
  PREVIEW_SECONDS,
  PREVIEWS_PER_DAY,
} from "@/lib/public-preview";

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
 * type their Twitch name, no account. Written out in full because Reddit only
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
        return (await arcticShiftGet("posts", sub)) as Array<Record<string, unknown>>;
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
  /** Their own free report, when their post linked their channel. */
  report?: ReportForDraft;
}

/**
 * A streamer's own free report, run on their latest stream before the DM
 * is written, so the message can say what it found and link to it.
 */
export interface ReportForDraft {
  /** Their report's page. */
  url: string;
  /** The stream it read. */
  streamTitle: string;
  /** The one thing it said to fix first, in the coach's words. */
  fix: string | null;
  /** Something it said worked, in the coach's words. */
  working: string | null;
}

const REPORT_BASE = "https://www.levlcast.com/analyze/";

/**
 * The Twitch channel a post links, if it links one. Only an explicit
 * twitch.tv link counts: a Reddit name that happens to match a Twitch
 * channel could be somebody else, and a DM about a stranger's stream is
 * worse than no report at all.
 */
export function findTwitchChannel(text: string): string | null {
  const links = text.match(/(?:https?:\/\/)?(?:www\.|m\.)?twitch\.tv\/[A-Za-z0-9_]{3,25}(?:\/[A-Za-z]+)?/gi) ?? [];
  for (const link of links) {
    const login = extractChannel(link);
    if (login) return login;
  }
  return null;
}

/** "**Label**. body" as plain words. */
function plainItem(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const m = s.match(/^\s*\*\*([\s\S]+?)\*\*\s*[—–.:-]?\s*([\s\S]*)$/);
  const text = (m ? `${m[1].trim()}: ${m[2].trim()}` : s).replace(/\*\*/g, "").trim();
  return text || null;
}

function reportFromPreview(row: {
  twitch_vod_id: string;
  title?: string | null;
  coach_report?: Record<string, unknown> | null;
}): ReportForDraft | null {
  const r = row.coach_report;
  if (!r) return null;
  const strengths = Array.isArray(r.strengths) ? (r.strengths as unknown[]) : [];
  return {
    url: `${REPORT_BASE}${row.twitch_vod_id}`,
    streamTitle: String(row.title ?? "their last stream"),
    fix: plainItem(r.recommendation),
    working: plainItem(strengths[0]),
  };
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
function systemPrompt(angle: Angle, report?: ReportForDraft): string {
  const known = report
    ? `You're sending a Reddit message to a streamer who posted asking for help. Their post linked their Twitch channel, so before messaging you ran their latest stream ("${report.streamTitle}") through LevlCast. You haven't watched it yourself. All you know about the stream is what their report found, below, so never claim more than that, and never make up numbers or details.

WHAT THEIR REPORT FOUND
${report.fix ? `- The one thing to fix first: ${report.fix}\n` : ""}${report.working ? `- Something that worked: ${report.working}\n` : ""}`
    : `You're sending a Reddit message to a streamer who posted asking for help. You only know what's in their post. You haven't watched their stream or looked at their channel, so never say or imply you did, and never make up numbers or details they didn't write.
`;
  const steps = report
    ? `1. React to what they actually said, in your own words, so it's obvious you read their post.
2. Say plainly that you made a site that reads streams and ran their last one through it, then pass on ONE thing it found, in your own words, short and specific. Pick whichever fits what they asked about.
3. The link to their report on its own line, exactly: ${report.url}
4. That the whole report is already there, free, and they don't need an account.`
    : `1. React to what they actually said, in your own words, so it's obvious you read their post.
2. One real tip that helps with what they asked. It has to be useful even if they never click anything.
3. Say plainly that you made a tool for this (for example "I actually made a free site for this" or "I built a thing that does this"), and what it would show them: ${angle.brief}
4. The link on its own line, exactly: ${OUTREACH_LINK}
5. That it's free to try and they don't need an account.`;
  return `You're Landon. You stream on Twitch and you built LevlCast, a site where you type your Twitch name and it goes through your last stream and tells you what happened: where people dropped off, how much dead air there was, which moments are worth clipping, and it ranks you from Iron to Grandmaster so you can see if you're getting better.

${known}
HOW LANDON TYPES
Like he's texting a friend on his phone. Casual, simple words, contractions, short sentences, a little run-on is fine, starting a sentence lowercase is fine. Real messages he's typed:
"Awesome! Sorry for forgetting! I hope it proved useful to you."
"I did a recent update for it including ranks and a bit of an update to how it works so I been putting it back out there lol"
"thats awesome super proud of that I hope I helped in some ways!"
It should read like one person typed it in a minute, not like something written and edited.

WHAT TO WRITE, IN THIS ORDER
${steps}

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

  const link = input.report?.url ?? OUTREACH_LINK;
  const res = await anthropic.messages.create({
    model: "claude-sonnet-5",
    // Sonnet 5 thinks before it answers unless told otherwise, at "high"
    // effort by default, and the thinking bills as output. At that setting
    // it could spend more than 1,500 tokens thinking about a 60-word DM
    // (the reason this ceiling once had to go from 1500 to 8000). "low"
    // keeps the model and its voice and lets it think only as much as a
    // short message needs. The ceiling is headroom, not a target: a reply
    // that hits it is a failed draft, and the lead is tried again next run.
    max_tokens: 3000,
    system: systemPrompt(angle, input.report),
    messages: [{ role: "user", content: lines.join("\n") }],
    // `output_config` postdates the installed SDK's types, like "refusal"
    // below, but the SDK sends the body as given and the API reads it.
    ...({ output_config: { effort: "low" } } as object),
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
    return { kind: "draft", ...finishDraft(parsed.subject ?? "", parsed.body, link) };
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
export function finishDraft(subject: string, body: string, link: string = OUTREACH_LINK): { subject: string; body: string } {
  const stripDashes = (s: string) =>
    s
      .replace(/\s+(?:—|–|--)\s+/g, ", ")
      .replace(/—|–|--/g, " ");

  let text = stripDashes(body);

  // levlcast.com, www.levlcast.com/analyze, http://levlcast.com/... all
  // become the one link. Trailing punctuation stays outside the match, and
  // the lookbehind leaves an email address like landon@levlcast.com alone.
  text = text.replace(/(?<![@\w.])(?:https?:\/\/)?(?:www\.)?levlcast\.com(?:\/[^\s)]*[^\s).,!?])?/gi, link);

  // Keep the first link, drop any repeats.
  let seen = false;
  text = text.replace(new RegExp(escapeRegExp(link), "g"), (m) => {
    if (seen) return "";
    seen = true;
    return m;
  });
  if (!seen) text = `${text.trimEnd()}\n\n${link}`;

  // The link always sits on its own line, so it's the obvious thing to tap
  // and never runs into the next sentence. The model mostly drops it
  // mid-paragraph ("...why. https://... it's free to try"), prompt or not.
  text = text.replace(
    new RegExp(`[ \\t]*${escapeRegExp(link)}[.,!?;:]?[ \\t]*`),
    `\n\n${link}\n\n`
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

/** Previews the harvest may start in one run. Each is about a nickel. */
const MAX_REPORT_STARTS_PER_RUN = 2;
/** The same daily ceiling the public analyzer holds; outreach counts toward it. */
const PREVIEW_DAILY_CEILING = PREVIEWS_PER_DAY;

type ReportPrep =
  | { kind: "ready"; report: ReportForDraft; vodId: string }
  | { kind: "waiting"; vodId: string; started: boolean }
  | { kind: "none" };

/** Whether migration 034 (report_vod_id) has been run. */
async function reportsSupported(admin: ReturnType<typeof createAdminClient>): Promise<boolean> {
  const { error } = await admin.from("outreach_contacts").select("report_vod_id").limit(1);
  return !error;
}

/**
 * Get a free report on this channel's latest stream: already done, being
 * made (start it if allowed), or not possible. Any failure means "none",
 * and the DM goes out the normal way.
 */
async function prepareReport(
  admin: ReturnType<typeof createAdminClient>,
  login: string,
  mayStart: boolean
): Promise<ReportPrep> {
  try {
    const found = await latestVodForChannel(login);
    if (found.kind !== "vod") return { kind: "none" };
    const vodId = found.vodId;

    const { data: existing } = await admin
      .from("public_previews")
      .select("twitch_vod_id, status, title, coach_report, created_at")
      .eq("twitch_vod_id", vodId)
      .maybeSingle();
    if (existing?.status === "ready") {
      const report = reportFromPreview(existing);
      return report ? { kind: "ready", report, vodId } : { kind: "none" };
    }
    const inFlight =
      !!existing &&
      ["pending", "transcribing", "analyzing"].includes(String(existing.status)) &&
      Date.now() - Date.parse(String(existing.created_at)) < 15 * 60 * 1000;
    if (inFlight) return { kind: "waiting", vodId, started: false };
    if (!mayStart) return { kind: "none" };

    const dayAgo = new Date(Date.now() - 86400000).toISOString();
    const { count, error: countErr } = await admin
      .from("public_previews")
      .select("id", { count: "exact", head: true })
      .gte("created_at", dayAgo);
    if (countErr || (count ?? 0) >= PREVIEW_DAILY_CEILING) return { kind: "none" };

    const meta = await fetchPreviewVodMeta(vodId);
    if (!meta || (meta.durationSeconds > 0 && meta.durationSeconds < MIN_PREVIEW_SECONDS)) return { kind: "none" };

    const { data: row, error } = await admin
      .from("public_previews")
      .upsert(
        {
          twitch_vod_id: vodId,
          title: meta.title,
          streamer_login: meta.streamerLogin,
          streamer_display_name: meta.streamerDisplayName,
          thumbnail_url: meta.thumbnailUrl,
          duration_seconds: meta.durationSeconds,
          analyzed_seconds: PREVIEW_SECONDS,
          status: "pending",
          failed_reason: null,
          coach_report: null,
          peak_data: null,
          created_ip: "outreach",
          created_at: new Date().toISOString(),
        },
        { onConflict: "twitch_vod_id" }
      )
      .select("id")
      .single();
    if (error || !row) return { kind: "none" };

    await inngest.send({
      id: `outreach-preview-${row.id}-${Date.now()}`,
      name: "public/preview",
      data: { previewId: row.id, twitchVodId: vodId, title: meta.title },
    });
    return { kind: "waiting", vodId, started: true };
  } catch (err) {
    console.warn("[outreach] report prep failed:", err instanceof Error ? err.message : err);
    return { kind: "none" };
  }
}

/**
 * Write DMs that were waiting on a streamer's report. Called when that
 * preview finishes, and by the harvest for any that have waited too long
 * (a report that failed, or never started). No report still gets the
 * normal message; they're never left waiting forever.
 */
export async function draftWaitingForReport(opts: {
  vodId?: string;
  olderThanMinutes?: number;
  limit?: number;
}): Promise<{ drafted: number; skipped: number }> {
  const admin = createAdminClient();
  let q = admin
    .from("outreach_contacts")
    .select("id, reddit_username, source, subreddit, post_title, post_excerpt, angle, report_vod_id")
    .eq("status", "waiting_report");
  if (opts.vodId) q = q.eq("report_vod_id", opts.vodId);
  if (opts.olderThanMinutes) q = q.lt("created_at", new Date(Date.now() - opts.olderThanMinutes * 60000).toISOString());
  const { data: rows, error } = await q.limit(opts.limit ?? 5);
  if (error || !rows) return { drafted: 0, skipped: 0 };

  let drafted = 0;
  let skipped = 0;
  for (const row of rows as Array<Record<string, string | null>>) {
    let report: ReportForDraft | undefined;
    if (row.report_vod_id) {
      const { data: p } = await admin
        .from("public_previews")
        .select("twitch_vod_id, status, title, coach_report")
        .eq("twitch_vod_id", row.report_vod_id)
        .maybeSingle();
      if (p?.status === "ready") report = reportFromPreview(p) ?? undefined;
    }
    const username = String(row.reddit_username ?? "");
    const angle = ANGLES.find((a) => a.id === row.angle) ?? angleFor(username);
    let result: DraftResult;
    try {
      result = await draftMessage(
        {
          username,
          source: row.source === "comment" ? "comment" : "post",
          subreddit: row.subreddit,
          title: row.post_title,
          body: row.post_excerpt,
          report,
        },
        angle
      );
    } catch (err) {
      console.warn("[outreach] waiting draft failed:", err instanceof Error ? err.message : err);
      continue;
    }
    if (result.kind === "failed") continue;
    await admin
      .from("outreach_contacts")
      .update(
        result.kind === "draft"
          ? { status: "queued", message_subject: result.subject, message_body: result.body }
          : { status: "skipped", skip_reason: `model: ${result.reason}`.slice(0, 200) }
      )
      .eq("id", String(row.id))
      .eq("status", "waiting_report");
    if (result.kind === "draft") drafted++;
    else skipped++;
  }
  return { drafted, skipped };
}

/**
 * Harvest, draft and queue. Records skips as rows so the same person is
 * never evaluated twice.
 *
 * When a post links the person's Twitch channel, their latest stream gets
 * a free report first and the DM waits for it (status waiting_report),
 * then says what it found and links to it. A report already made is used
 * straight away.
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
): Promise<{ queued: number; skipped: number; attempts: number; waiting: number }> {
  const admin = createAdminClient();

  // DMs that waited too long for a report go out without one.
  const late = await draftWaitingForReport({ olderThanMinutes: 45, limit: 2 });

  const leads = await harvestLeads(maxAttempts + MAX_REPORT_STARTS_PER_RUN);

  let queued = late.drafted;
  let skipped = late.skipped;
  let attempts = late.drafted + late.skipped;
  let waiting = 0;
  let reportsStarted = 0;
  let seen = 0;
  const reportsOn = await reportsSupported(admin);

  const { count: contactedSoFar } = await admin
    .from("outreach_contacts")
    .select("id", { count: "exact", head: true });
  const angleSeed = contactedSoFar ?? 0;

  for (const lead of leads) {
    if (queued >= max || attempts >= maxAttempts) break;

    // Rotate the angle so a run of messages does not all make the same
    // argument. Counted once before the loop, not once per lead: this was
    // a full count query per candidate, and it never changed often enough
    // to be worth re-reading mid-run.
    const angle = ANGLES[(angleSeed + seen) % ANGLES.length];
    seen++;

    const baseRow = {
      reddit_username: lead.username.toLowerCase(),
      source: lead.source,
      subreddit: lead.subreddit,
      permalink: lead.permalink,
      post_title: lead.title,
      post_excerpt: lead.body.slice(0, 600),
      angle: angle.id,
    };

    // Their own report, when their post links their channel.
    let report: ReportForDraft | undefined;
    const channel = reportsOn ? findTwitchChannel(`${lead.title} ${lead.body}`) : null;
    if (channel) {
      const prep = await prepareReport(admin, channel, reportsStarted < MAX_REPORT_STARTS_PER_RUN);
      if (prep.kind === "ready") report = prep.report;
      if (prep.kind === "waiting") {
        if (prep.started) reportsStarted++;
        const { error } = await admin
          .from("outreach_contacts")
          .insert({ ...baseRow, status: "waiting_report", report_vod_id: prep.vodId });
        if (!error) waiting++;
        continue;
      }
    }

    attempts++;
    let drafted: DraftResult;
    try {
      drafted = await draftMessage({ ...lead, report }, angle);
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
      ...baseRow,
      ...(drafted.kind === "draft"
        ? { status: "queued", message_subject: drafted.subject, message_body: drafted.body }
        : { status: "skipped", skip_reason: `model: ${drafted.reason}`.slice(0, 200) }),
      ...(report && reportsOn ? { report_vod_id: report.url.slice(REPORT_BASE.length) } : {}),
    };

    // Unique index on reddit_username makes this safe against races: a
    // duplicate insert fails and is simply counted, never retried.
    const { error } = await admin.from("outreach_contacts").insert(row);
    if (error) continue;

    if (drafted.kind === "draft") queued++;
    else skipped++;
  }

  return { queued, skipped, attempts, waiting };
}
