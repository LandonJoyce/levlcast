/**
 * The free report on a stream's opening, shown on that stream's page while
 * its full report is being made.
 *
 * A first full report takes around ten minutes, and a new streamer used to
 * spend all of it looking at a progress bar. Most of them signed up from
 * the free report on the very stream it's running on, so that report is
 * already there to read in the meantime. Anyone who didn't run one first
 * gets one started at sign-up (auth/callback): it's a single 12-minute part
 * and it's back in a minute or two.
 */

import { createAdminClient } from "@/lib/supabase/server";
import { inngest } from "@/lib/inngest/client";
import { fetchPreviewVodMeta, MIN_PREVIEW_SECONDS, PREVIEW_SECONDS, PREVIEWS_PER_DAY } from "@/lib/public-preview";
import type { PreviewPayload } from "@/components/preview/preview-report";

/** A free report still running after this long has stalled. */
const STALE_AFTER_MS = 15 * 60 * 1000;

export type WaitingPreviewState = { kind: "ready"; preview: PreviewPayload } | { kind: "running" };

/** The free report on this stream, if there's one to show or one on its way. */
export async function loadWaitingPreview(twitchVodId: string | null | undefined): Promise<WaitingPreviewState | null> {
  if (!twitchVodId || !/^\d{6,}$/.test(twitchVodId)) return null;
  try {
    // Previews are read through the admin client everywhere; the table
    // isn't open to the browser.
    const { data } = await createAdminClient()
      .from("public_previews")
      .select("twitch_vod_id, status, title, duration_seconds, analyzed_seconds, coach_report, peak_data, created_at")
      .eq("twitch_vod_id", twitchVodId)
      .maybeSingle();
    if (!data) return null;
    if (data.status === "ready" && data.coach_report) return { kind: "ready", preview: data as PreviewPayload };
    const running =
      ["pending", "transcribing", "analyzing"].includes(String(data.status)) &&
      Date.now() - Date.parse(String(data.created_at)) < STALE_AFTER_MS;
    return running ? { kind: "running" } : null;
  } catch {
    return null;
  }
}

/**
 * Start the free report on a new streamer's first stream, unless the stream
 * has one already. That includes one that failed, since it would most
 * likely fail the same way again (a muted opening, say). Counts toward the
 * day's ceiling like any other preview. Never throws.
 */
export async function startWaitingPreview(twitchVodId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("public_previews")
      .select("id")
      .eq("twitch_vod_id", twitchVodId)
      .maybeSingle();
    if (existing) return;

    const dayAgo = new Date(Date.now() - 86400000).toISOString();
    const { count, error: countErr } = await admin
      .from("public_previews")
      .select("id", { count: "exact", head: true })
      .gte("created_at", dayAgo);
    if (countErr || (count ?? 0) >= PREVIEWS_PER_DAY) return;

    const meta = await fetchPreviewVodMeta(twitchVodId);
    if (!meta || (meta.durationSeconds > 0 && meta.durationSeconds < MIN_PREVIEW_SECONDS)) return;

    // Insert, not upsert: if a report on this stream was started a moment
    // ago somewhere else, the unique key turns this one away instead of
    // resetting that one.
    const { data: row, error } = await admin
      .from("public_previews")
      .insert({
        twitch_vod_id: twitchVodId,
        title: meta.title,
        streamer_login: meta.streamerLogin,
        streamer_display_name: meta.streamerDisplayName,
        thumbnail_url: meta.thumbnailUrl,
        duration_seconds: meta.durationSeconds,
        analyzed_seconds: PREVIEW_SECONDS,
        status: "pending",
        created_ip: "signup",
      })
      .select("id")
      .single();
    if (error || !row) return;

    try {
      await inngest.send({
        id: `signup-preview-${row.id}`,
        name: "public/preview",
        data: { previewId: row.id, twitchVodId, title: meta.title },
      });
    } catch (err) {
      // Same as the analyzer: never leave a row that looks like it's running.
      await admin
        .from("public_previews")
        .update({ status: "failed", failed_reason: "Couldn't start the analysis. Try again." })
        .eq("id", row.id);
      throw err;
    }
    console.log(`[waiting-preview] started the free report on ${twitchVodId} for a new sign-up`);
  } catch (err) {
    console.warn("[waiting-preview] start failed:", err instanceof Error ? err.message : err);
  }
}
