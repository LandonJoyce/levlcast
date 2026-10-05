/**
 * Review threads: Landon posts "drop your Twitch name and I'll look at your
 * last stream", and this turns the replies into free reports and drafted
 * answers.
 *
 * Nothing is posted from here. Every reply is read, copied and posted by
 * hand under the person's own comment. These people asked for a review, so
 * unlike outreach there's no relevance filter and no dedup: anyone who
 * comments a name gets their report.
 *
 * Reports are the same free preview the public analyzer makes, started
 * without the per-IP cap (one person running 30 reviews from one machine
 * would hit it on the fourth) but still counted against the shared daily
 * ceiling, so a busy thread can't drain the Deepgram balance.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/server";
import { inngest } from "@/lib/inngest/client";
import { extractChannel } from "@/lib/twitch-input";
import { isRedditConfigured, redditGet } from "@/lib/reddit";
import { finishDraft } from "@/lib/outreach";
import {
  fetchPreviewVodMeta,
  latestVodForChannel,
  MIN_PREVIEW_SECONDS,
  PREVIEW_SECONDS,
  PREVIEWS_PER_DAY,
} from "@/lib/public-preview";

/** On every link in a thread reply, so the funnel can count what threads bring in. */
export const THREAD_REF = "thread";

const REPORT_BASE = "https://www.levlcast.com/analyze/";

export function reportLink(vodId: string): string {
  return `${REPORT_BASE}${vodId}?ref=${THREAD_REF}`;
}

/** One reply in the thread, or one pasted name. */
export interface ThreadEntry {
  /** The comment id, or the login for a pasted name. */
  key: string;
  author: string | null;
  comment: string | null;
  permalink: string | null;
  /** The Twitch name, when the comment gives it plainly. Runs straight away. */
  login: string | null;
  /** A name read out of a sentence ("my twitch is x"). Shown, but only runs once confirmed. */
  guess: string | null;
  /** The subreddit the reply is in, when it came from a thread. */
  sub?: string | null;
}

const SKIP_AUTHORS = new Set(["automoderator", "[deleted]", "reddit", "bmwdouche"]);

/** Words that come after "my twitch is" without being a name: "my channel is small". */
const NOT_NAMES = new Set([
  "is", "my", "the", "here", "mine", "please", "thanks", "thank", "and", "on", "at", "name",
  "channel", "twitch", "link", "username", "user", "called", "just", "also", "would", "love",
  "a", "an", "not", "so", "very", "pretty", "really", "still", "kinda", "super", "only",
  "small", "new", "tiny", "big", "dead", "slow", "hard", "difficult", "tough", "rough", "growing",
  "good", "bad", "great", "fun", "boring", "empty", "quiet", "live", "down", "up", "ok", "okay", "fine",
  // Whole comments that are one word without being a name.
  "lol", "lmao", "nice", "cool", "yes", "yep", "nope", "wow", "same", "this", "me", "bump", "hi", "hey",
  "hello", "awesome", "dope", "bet", "thx", "following", "interested", "done", "deleted", "removed",
]);

const TWITCH_LINK = /(?:https?:\/\/)?(?:www\.|m\.)?twitch\.tv\/[A-Za-z0-9_]{3,25}(?:\/[A-Za-z]+)?/gi;

/**
 * The Twitch name in a comment.
 *
 * Sure: a twitch.tv link, or a comment that is nothing but a name. A guess:
 * "my twitch is x", which also matches "my channel is small", and a report
 * on a stranger called "small" is worse than asking. Guesses wait for a
 * click.
 */
export function nameFromComment(body: string): { login: string; sure: boolean } | null {
  for (const link of body.match(TWITCH_LINK) ?? []) {
    const login = extractChannel(link);
    if (login) return { login, sure: true };
  }

  // Just the name, give or take an @ in front or "!!", a period or an emoji after.
  const alone = body.trim().replace(/^[^A-Za-z0-9_]+/, "").replace(/[^A-Za-z0-9_]+$/, "");
  if (/^[A-Za-z0-9_]{3,25}$/.test(alone) && !/^\d+$/.test(alone) && !NOT_NAMES.has(alone.toLowerCase())) {
    return { login: alone.toLowerCase(), sure: true };
  }

  // "my twitch is x", "twitch: x", "twitch name is x". Not "streaming on twitch is hard".
  const said =
    body.match(/\bmy\s+(?:twitch|channel)(?:\s+(?:user)?name)?\s+is\s+@?([A-Za-z0-9_]{3,25})\b/i) ??
    body.match(/\b(?:twitch|channel|user ?name|name)\s*[:=]\s*@?([A-Za-z0-9_]{3,25})\b/i) ??
    body.match(/\btwitch\s+(?:user)?name\s+is\s+@?([A-Za-z0-9_]{3,25})\b/i);
  const name = said?.[1];
  if (name && !/^\d+$/.test(name) && !NOT_NAMES.has(name.toLowerCase())) {
    return { login: name.toLowerCase(), sure: false };
  }
  return null;
}

/** Names or links pasted one per line. Duplicates dropped, order kept. */
export function namesFromLines(text: string): ThreadEntry[] {
  const seen = new Set<string>();
  const out: ThreadEntry[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // A pasted line is meant to be a name, so whatever it yields is sure.
    const login = extractChannel(trimmed) ?? nameFromComment(trimmed)?.login ?? null;
    if (!login || seen.has(login)) continue;
    seen.add(login);
    out.push({ key: login, author: null, comment: null, permalink: null, login, guess: null });
  }
  return out;
}

/** The post id in a Reddit thread link (/comments/<id>/ or redd.it/<id>). */
export function redditPostId(url: string): string | null {
  const m =
    url.match(/reddit\.com\/(?:r\/[^/\s]+\/)?comments\/([a-z0-9]{4,12})/i) ?? url.match(/redd\.it\/([a-z0-9]{4,12})/i);
  return m ? m[1].toLowerCase() : null;
}

/** Every thread linked in some pasted text, once each. */
export function threadIds(text: string): string[] {
  const ids = text.split(/\s+/).map(redditPostId).filter((id): id is string => !!id);
  return [...new Set(ids)];
}

type RawComment = {
  id?: string;
  author?: string;
  body?: string;
  permalink?: string;
  parent_id?: string;
  created_utc?: number;
};

/**
 * The top-level replies to a thread, oldest first. Reddit itself when the
 * OAuth app is set up, otherwise the Arctic Shift mirror, which picks up
 * new comments within minutes.
 */
export async function fetchThread(postId: string): Promise<ThreadEntry[]> {
  let comments: RawComment[] = [];

  if (isRedditConfigured()) {
    const json = await redditGet(`/comments/${postId}?limit=500&depth=1&raw_json=1`);
    const children: Array<{ kind?: string; data?: RawComment }> = json?.[1]?.data?.children ?? [];
    comments = children.filter((c) => c.kind === "t1").map((c) => c.data ?? {});
  } else {
    let after = 0;
    for (let page = 0; page < 4; page++) {
      const url = `https://arctic-shift.photon-reddit.com/api/comments/search?link_id=${postId}&limit=100&sort=asc${after ? `&after=${after}` : ""}`;
      const res = await fetch(url, { headers: { "User-Agent": "LevlCast/1.0", Accept: "application/json" } });
      if (!res.ok) throw new Error(`The Reddit mirror said ${res.status}. Try again in a minute.`);
      const json = await res.json();
      // A busy mirror answers 200 with {"error": "Timeout. Maybe slow down a bit"} and no data.
      if (json?.error) throw new Error(`The Reddit mirror is busy (${json.error}). Try again in a minute.`);
      const rows = (json?.data ?? []) as RawComment[];
      comments.push(...rows);
      if (rows.length < 100) break;
      after = Number(rows[rows.length - 1].created_utc ?? 0) + 1;
    }
  }

  return comments
    .filter((c) => c.parent_id === `t3_${postId}`)
    .filter((c) => {
      const author = String(c.author ?? "").toLowerCase();
      if (!author || SKIP_AUTHORS.has(author)) return false;
      const body = String(c.body ?? "");
      return body !== "[deleted]" && body !== "[removed]";
    })
    .sort((a, b) => Number(a.created_utc ?? 0) - Number(b.created_utc ?? 0))
    .map((c) => {
      const body = String(c.body ?? "");
      const found = nameFromComment(body);
      return {
        key: String(c.id),
        author: String(c.author),
        comment: body.slice(0, 600),
        permalink: c.permalink ? `https://www.reddit.com${c.permalink}` : null,
        login: found?.sure ? found.login : null,
        guess: found && !found.sure ? found.login : null,
        sub: c.permalink?.match(/^\/r\/([^/]+)\//)?.[1] ?? null,
      };
    });
}

export type StartState = "ready" | "waiting" | "no_channel" | "no_vods" | "too_short" | "cap" | "error";

export interface StartResult {
  state: StartState;
  vodId?: string;
  displayName?: string;
}

/** Start (or find) the free report on this channel's latest stream. */
export async function startReview(login: string): Promise<StartResult> {
  const admin = createAdminClient();
  try {
    const found = await latestVodForChannel(login);
    if (found.kind === "no_channel") return { state: "no_channel" };
    if (found.kind !== "vod") return { state: found.kind, displayName: found.displayName };
    const { vodId, displayName } = found;

    const { data: existing } = await admin
      .from("public_previews")
      .select("status, created_at")
      .eq("twitch_vod_id", vodId)
      .maybeSingle();
    if (existing?.status === "ready") return { state: "ready", vodId, displayName };
    const inFlight =
      !!existing &&
      ["pending", "transcribing", "analyzing"].includes(String(existing.status)) &&
      Date.now() - Date.parse(String(existing.created_at)) < 15 * 60 * 1000;
    if (inFlight) return { state: "waiting", vodId, displayName };

    const dayAgo = new Date(Date.now() - 86400000).toISOString();
    const { count, error: countErr } = await admin
      .from("public_previews")
      .select("id", { count: "exact", head: true })
      .gte("created_at", dayAgo);
    if (countErr || (count ?? 0) >= PREVIEWS_PER_DAY) return { state: "cap", displayName };

    const meta = await fetchPreviewVodMeta(vodId);
    if (!meta) return { state: "error", displayName };
    if (meta.durationSeconds > 0 && meta.durationSeconds < MIN_PREVIEW_SECONDS) return { state: "too_short", displayName };

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
          created_ip: "review-thread",
          created_at: new Date().toISOString(),
        },
        { onConflict: "twitch_vod_id" }
      )
      .select("id")
      .single();
    if (error || !row) return { state: "error", displayName };

    await inngest.send({
      id: `review-thread-${row.id}-${Date.now()}`,
      name: "public/preview",
      data: { previewId: row.id, twitchVodId: vodId, title: meta.title },
    });
    return { state: "waiting", vodId, displayName };
  } catch (err) {
    console.warn("[review-thread] start failed:", err instanceof Error ? err.message : err);
    return { state: "error" };
  }
}

/**
 * Ready-made answers for when there's no report to talk about, in Landon's
 * voice. The daily cap and errors aren't the commenter's business, so
 * those get no canned reply: run them again later.
 */
export function cannedReply(state: StartState, login: string): string | null {
  switch (state) {
    case "no_channel":
      return `couldn't find a twitch channel called ${login}, is that the right spelling?`;
    case "no_vods":
      return "you don't have past broadcasts saved so there's nothing for it to read yet. if you turn on Store past broadcasts (Creator Dashboard, Settings, Stream) I'll run your next one";
    case "too_short":
      return "your recent streams are all under 5 minutes so there's not much to go on yet. next time you do a longer one let me know and I'll run it";
    default:
      return null;
  }
}

/** "**Label**. body" as plain words. Same as the outreach drafts use. */
function plainItem(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const m = s.match(/^\s*\*\*([\s\S]+?)\*\*\s*[—–.:-]?\s*([\s\S]*)$/);
  const text = (m ? `${m[1].trim()}: ${m[2].trim()}` : s).replace(/\*\*/g, "").trim();
  return text || null;
}

export interface ReviewReport {
  title: string;
  fix: string | null;
  working: string | null;
  best: string | null;
  said: string | null;
}

export function reviewReport(row: {
  title?: string | null;
  coach_report?: Record<string, unknown> | null;
}): ReviewReport | null {
  const r = row.coach_report;
  if (!r) return null;
  const strengths = Array.isArray(r.strengths) ? (r.strengths as unknown[]) : [];
  const best = r.best_moment as { time?: string; description?: string } | undefined;
  const quotes = Array.isArray(r.anti_patterns)
    ? (r.anti_patterns as Array<{ time?: string; quote?: string; note?: string }>)
    : [];
  const q = quotes.find((x) => x?.quote);
  return {
    title: String(row.title ?? "their last stream"),
    fix: plainItem(r.recommendation),
    working: plainItem(strengths[0]),
    best: best?.description ? `${best.time ? `${best.time}, ` : ""}${best.description}` : null,
    said: q?.quote ? `"${q.quote}"${q.time ? ` at ${q.time}` : ""}${q.note ? `, ${q.note}` : ""}` : null,
  };
}

/**
 * The reply prompt. Same voice as the outreach DMs, with real messages
 * Landon typed as the reference, because a described voice comes out
 * tidier than the real one.
 */
function replyPrompt(report: ReviewReport, url: string, author: string | null, comment: string | null): string {
  const found = [
    report.fix ? `- The one thing to fix first: ${report.fix}` : null,
    report.working ? `- Something that worked: ${report.working}` : null,
    report.best ? `- The best moment: ${report.best}` : null,
    report.said ? `- Something they said that cost them: ${report.said}` : null,
  ].filter(Boolean);
  const who = author ? `u/${author}` : "Someone";
  const what = comment ? ` with: "${comment.slice(0, 400)}"` : " with their Twitch name";
  return `You're Landon. You stream on Twitch and you built LevlCast, a site that goes through a stream and points out where viewers probably left (dead air, slow starts and so on), what worked, and the moments worth clipping.

You posted a thread on Reddit offering to look at people's last streams for free. ${who} replied${what}. You ran their latest stream ("${report.title}") through LevlCast. You haven't watched it yourself. All you know about the stream is what the report found, below, so never claim more than that, and never make up numbers or details.

WHAT THEIR REPORT FOUND
${found.join("\n")}

HOW LANDON TYPES
Like he's texting a friend on his phone. Casual, simple words, contractions, short sentences, a little run-on is fine, starting a sentence lowercase is fine. Real messages he's typed:
"Awesome! Sorry for forgetting! I hope it proved useful to you."
"I did a recent update for it including ranks and a bit of an update to how it works so I been putting it back out there lol"
"thats awesome super proud of that I hope I helped in some ways!"
It should read like one person typed it in a minute, not like something written and edited.

WHAT TO WRITE
A reply under their comment, in this order:
1. The one thing you'd fix first, in your own words, short and specific. Use a timestamp from the report if there is one.
2. One thing that worked or the best moment, short.
3. The link to their full report on its own line, exactly: ${url}

RULES
- 35 to 80 words.
- Get straight into it. No greeting, no thanking them for commenting.
- The link appears once, written exactly as above so it's clickable.
- No dashes of any kind (no em dash, no en dash, no double hyphen). Use commas and periods.
- Nothing that sounds like an ad or a template: no "Hey there", "great question", "game changer", "level up", "take your stream to the next level", no lists, no bold, no emoji, no hashtags.
- At most one exclamation mark.
- No prices, no "trial", no pressure, and don't tell them to sign up.

OUTPUT
Return only the reply text.`;
}

/** Draft the reply to one person from their finished report. */
export async function draftReviewReply(input: {
  report: ReviewReport;
  vodId: string;
  author: string | null;
  comment: string | null;
}): Promise<string> {
  const url = reportLink(input.vodId);
  const anthropic = new Anthropic();
  const res = await anthropic.messages.create({
    model: "claude-sonnet-5",
    // Same settings as the outreach drafts: low effort keeps a short reply
    // from spending more on thinking than on writing.
    max_tokens: 3000,
    system: replyPrompt(input.report, url, input.author, input.comment),
    messages: [{ role: "user", content: "Write the reply." }],
    ...({ output_config: { effort: "low" } } as object),
  });
  if (res.stop_reason === "max_tokens") throw new Error("ran out of room before finishing");
  if ((res.stop_reason as string | null) === "refusal") throw new Error("declined to write it");
  // All the text, not the first block: with thinking on, the answer can
  // come in more than one (see generateCoachReport).
  const raw = res.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n")
    .trim();
  if (!raw) throw new Error("empty reply");
  return finishDraft("", raw.replace(/^["']|["']$/g, ""), url).body;
}
