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
    title: shorten(text, 70),
    start,
    end,
    score: 0,
    category: "highlight",
    reason: text,
    caption: shorten(text, 100),
    hook: "",
  };
}

/** Cut at a word, without a trailing full stop. */
function shorten(text: string, max: number): string {
  const t = text.replace(/[.!]+$/, "");
  if (t.length <= max) return t;
  return t.slice(0, max + 1).replace(/\s+\S*$/, "").replace(/[,;:\s]+$/, "") + "...";
}
