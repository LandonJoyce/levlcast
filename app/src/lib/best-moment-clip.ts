import type { Peak } from "@/lib/analyze";
import { secondsFromStamp } from "@/lib/moment-time";

/**
 * The coach's best moment as a clip, for streams where peak detection found
 * nothing worth clipping.
 *
 * Every analysis auto-cuts its top peak, so a report arrives with a clip
 * ready. A quiet stream has no peaks, and that's often a new streamer's
 * first report: it came back with no clip at all, one of the things they
 * signed up for. The report always names a best moment with a time, so that
 * becomes the clip instead.
 *
 * The coach's note about the moment is written to the streamer ("You'd gone
 * quiet through twenty minutes of tech trouble before..."), so it stays the
 * clip's reason and never becomes its title or caption, which viewers see
 * (YouTube title, the caption to post with it). nameBestMoment writes those.
 */

/** Seconds of lead-in before the moment, so it doesn't start mid-sentence. */
const LEAD_IN_SECONDS = 10;
/** Long enough to land the moment, short enough for a Short. */
const CLIP_SECONDS = 40;

export function bestMomentAsPeak(
  report: { best_moment?: { time?: string; description?: string } | null } | null | undefined,
  streamSeconds?: number | null
): Peak | null {
  const moment = report?.best_moment;
  const text = moment?.description?.trim().replace(/\s+/g, " ");
  if (!moment?.time || !text) return null;
  const at = secondsFromStamp(moment.time);
  if (!Number.isFinite(at) || at <= 0) return null;
  if (streamSeconds && at >= streamSeconds) return null;

  const start = Math.max(0, at - LEAD_IN_SECONDS);
  const end = streamSeconds ? Math.min(start + CLIP_SECONDS, streamSeconds) : start + CLIP_SECONDS;
  if (end - start < 15) return null;

  return {
    title: plainTitle(),
    start,
    end,
    score: 0,
    category: "highlight",
    reason: text,
    caption: "",
    hook: "",
  };
}

/** A title that's never wrong, for when there's nothing better. */
function plainTitle(game?: string | null): string {
  return game ? `Best moment in ${game}` : "Best moment from the stream";
}

/** Clip copy as people post it: no quote marks, dashes, hashtags or emoji, cut at a word. */
export function tidyClipText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const t = value
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/#\w+/g, "")
    .replace(/["“”`]/g, "")
    .replace(/^'+|'+$/g, "")
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim()
    .replace(/^,\s*|,\s*$/g, "");
  if (t.length <= max) return t;
  return t.slice(0, max + 1).replace(/\s+\S*$/, "").replace(/[,;:\s]+$/, "");
}

/**
 * A title and a caption for the best-moment clip, written for viewers from
 * what was said in it. One small Haiku call, and only for streams with no
 * peaks. Any trouble falls back to a plain title and no caption.
 */
export async function nameBestMoment(
  peak: Peak,
  segments: Array<{ start: number; end: number; text: string }>,
  info: { streamTitle?: string | null; game?: string | null } = {}
): Promise<Peak> {
  const plain: Peak = { ...peak, title: plainTitle(info.game), caption: "" };
  const said = segments
    .filter((s) => s.end > peak.start && s.start < peak.end)
    .map((s) => s.text.trim())
    .filter(Boolean)
    .join(" ")
    .slice(0, 1200);
  if (!said) return plain;

  const about = [info.game ? `of ${info.game}` : "", info.streamTitle ? `(stream title: ${info.streamTitle})` : ""].filter(Boolean).join(" ");
  const prompt = `You title Twitch clips for TikTok and YouTube Shorts.

This clip is the best moment from a stream${about ? ` ${about}` : ""}.
What was said in the clip:
${said}

Why it's the best moment, a note written to the streamer. It's context only, so don't reuse its wording:
${peak.reason}

Write for viewers, not the streamer:
- "title": under 60 characters, the way a streamer would title the clip.
- "caption": a post caption under 150 characters about what happens in this clip, specific to it.
No coaching, no quote marks, no em dashes, no hashtags, no emojis. Plain, casual words.
Reply with JSON only: {"title": "...", "caption": "..."}`;

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const res = await new Anthropic().messages.create(
      { model: "claude-haiku-4-5-20251001", max_tokens: 200, messages: [{ role: "user", content: prompt }] },
      { timeout: 20_000, maxRetries: 1 }
    );
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as { title?: unknown; caption?: unknown };
    const title = tidyClipText(json.title, 70);
    const caption = tidyClipText(json.caption, 150);
    return { ...peak, title: title || plain.title, caption };
  } catch (err) {
    console.warn("[analyze] Naming the best-moment clip failed, using a plain title:", err instanceof Error ? err.message : err);
    return plain;
  }
}
