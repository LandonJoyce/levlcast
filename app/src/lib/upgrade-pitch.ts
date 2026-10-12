/**
 * lib/upgrade-pitch.ts
 *
 * The one line at the top of the Pro popup, written from the free user's
 * own streams: the thing free didn't cover for them, said plainly. It used
 * to be a paragraph of averages and "one report just diagnoses", with a
 * "top 15% of streamers" line nobody had measured.
 *
 * Only true statements: a stream longer than the 2 hours free coaches, or
 * more streams this week than the one free report covers. Otherwise a
 * plain line about what Pro is.
 *
 * Called server-side from the dashboard layout.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { FREE_COACHED_SECONDS } from "@/lib/free-plan";

export interface UpgradePitch {
  /** The line for the UpgradeModal reason field. */
  reason: string;
}

const FALLBACK = "Pro coaches your whole stream, start to finish, and the coach in OBS listens while you're live.";

/** "3h 40m", "2h", "55m". */
function length(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export async function buildUpgradePitch(userId: string, supabase: SupabaseClient): Promise<UpgradePitch> {
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const [{ data: latest }, { count: thisWeek }] = await Promise.all([
    supabase
      .from("vods")
      .select("duration_seconds")
      .eq("user_id", userId)
      .eq("status", "ready")
      .order("stream_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("vods")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("stream_date", weekAgo),
  ]);

  const seconds = Number((latest as { duration_seconds?: number } | null)?.duration_seconds ?? 0);
  const freeHours = Math.round(FREE_COACHED_SECONDS / 3600);
  // Only when the cut was real: at least 15 minutes went uncoached.
  if (seconds >= FREE_COACHED_SECONDS + 15 * 60) {
    return {
      reason: `Your last stream was ${length(seconds)}, and free coached the first ${freeHours} hours. Pro coaches all of it.`,
    };
  }
  if ((thisWeek ?? 0) >= 2) {
    return { reason: `You went live ${thisWeek} times this week. Free coaches one stream a week. Pro coaches up to 20 a month.` };
  }
  return { reason: FALLBACK };
}
