/**
 * Public preview API — no authentication, by design.
 *
 * POST /api/public/analyze  { url }  → start (or reuse) a preview
 * GET  /api/public/analyze?vod=<id>  → poll its status
 *
 * This is the only endpoint in the app that spends money for someone who
 * has not signed in, so the guards matter more than the feature:
 *
 *   1. CACHE FIRST. Previews are unique per Twitch VOD id. A repeat link
 *      costs nothing and returns instantly.
 *   2. PER-IP CAP, counted in the DATABASE, not in memory. The in-memory
 *      limiter resets on every cold start, which on serverless is often
 *      enough to be meaningless for spend control.
 *   3. GLOBAL DAILY CAP that FAILS CLOSED. If the ceiling is hit, new
 *      previews are refused with a real message rather than quietly
 *      draining the Deepgram balance. Getting this wrong is what took the
 *      whole product down before.
 *
 * Every refusal returns a sentence a first-time visitor can act on. A
 * confusing error here costs a signup.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { inngest } from "@/lib/inngest/client";
import {
  extractVodId,
  extractChannel,
  describeBadInput,
  fetchPreviewVodMeta,
  latestVodForChannel,
  MIN_PREVIEW_SECONDS,
  PREVIEW_SECONDS,
  PREVIEWS_PER_DAY,
  type ChannelLookup,
} from "@/lib/public-preview";

export const dynamic = "force-dynamic";

/** Previews per IP per day. Enough to try a few streams, not enough to farm. */
const PER_IP_DAILY = 3;

/** Hard ceiling on previews started in a day, shared with outreach and sign-ups. */
const GLOBAL_DAILY = PREVIEWS_PER_DAY;

/**
 * A preview that has been running longer than this is considered dead, so
 * a visitor can retry the same VOD instead of being stuck behind a row
 * that will never finish.
 */
const STALE_MINUTES = 15;

function ipFrom(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/** Shape returned to the client for every state. Keep it stable. */
function previewPayload(row: Record<string, unknown>) {
  return {
    id: row.id,
    twitch_vod_id: row.twitch_vod_id,
    status: row.status,
    failed_reason: row.failed_reason ?? null,
    title: row.title ?? null,
    streamer_display_name: row.streamer_display_name ?? null,
    streamer_login: row.streamer_login ?? null,
    thumbnail_url: row.thumbnail_url ?? null,
    duration_seconds: row.duration_seconds ?? null,
    analyzed_seconds: row.analyzed_seconds ?? PREVIEW_SECONDS,
    game_category: row.game_category ?? null,
    coach_report: row.coach_report ?? null,
    peak_data: row.peak_data ?? null,
  };
}

export async function POST(request: Request) {
  const admin = createAdminClient();
  const ip = ipFrom(request);

  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const rawUrl = typeof body.url === "string" ? body.url : "";
  let vodId = extractVodId(rawUrl);
  // How they asked, for the funnel: a stream link, or their name.
  let via: "link" | "name" = "link";

  // A Twitch name instead of a link: their latest past broadcast.
  if (!vodId) {
    const login = extractChannel(rawUrl);
    if (!login) {
      return NextResponse.json({ error: describeBadInput(rawUrl) }, { status: 400 });
    }
    // A lookup costs us nothing, but it shouldn't be a free way to list
    // channels either.
    if (!rateLimit(`public-preview-lookup:${ip}`, 30, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "That's a lot of lookups for one hour. Paste a link to one of your streams instead, or try again later." },
        { status: 429 }
      );
    }
    let found: ChannelLookup;
    try {
      found = await latestVodForChannel(login);
    } catch (err) {
      console.error("[public-preview] Channel lookup failed:", err instanceof Error ? err.message : err);
      return NextResponse.json({ error: "Couldn't reach Twitch just now. Try again in a moment." }, { status: 503 });
    }
    if (found.kind === "no_channel") {
      return NextResponse.json(
        { error: `There's no Twitch channel called ${login}. Check the spelling, or paste a link to one of your streams.` },
        { status: 404 }
      );
    }
    if (found.kind === "no_vods") {
      return NextResponse.json(
        {
          error: `${found.displayName} has no past broadcasts saved on Twitch, so there's nothing to read yet. In your Creator Dashboard go to Settings, then Stream, and turn on Store past broadcasts. Your next stream will work here.`,
        },
        { status: 404 }
      );
    }
    if (found.kind === "too_short") {
      return NextResponse.json(
        { error: `${found.displayName}'s recent streams are all under 5 minutes, which isn't enough to coach. Stream a bit longer and come back.` },
        { status: 400 }
      );
    }
    vodId = found.vodId;
    via = "name";
  }

  // ---- 1. Cache -----------------------------------------------------
  // Checked before any limiter: reusing a finished preview is free, so a
  // rate-limited visitor should still be able to open a shared link.
  const { data: cached } = await admin
    .from("public_previews")
    .select("*")
    .eq("twitch_vod_id", vodId)
    .maybeSingle();

  if (cached) {
    const ageMinutes = (Date.now() - new Date(cached.created_at as string).getTime()) / 60000;
    const inFlight =
      cached.status === "pending" ||
      cached.status === "transcribing" ||
      cached.status === "analyzing";

    if (cached.status === "ready") {
      return NextResponse.json({ ...previewPayload(cached), cached: true, via });
    }
    // Still working and not stale — hand back the same row so two people
    // pasting the same link share one analysis instead of racing.
    if (inFlight && ageMinutes < STALE_MINUTES) {
      return NextResponse.json({ ...previewPayload(cached), via });
    }
    // Failed, or stale enough to be dead. Fall through and re-run it.
  }

  // ---- 2. Per-IP cap, counted in the database ------------------------
  // The in-memory limiter is a cheap first gate for bursts from one warm
  // instance; the DB count is the one that actually holds.
  if (!rateLimit(`public-preview:${ip}`, PER_IP_DAILY, 24 * 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: `You've used your ${PER_IP_DAILY} free reports for today. Connect Twitch for full reports on your own streams.` },
      { status: 429 }
    );
  }

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count: ipCount, error: ipCountErr } = await admin
    .from("public_previews")
    .select("id", { count: "exact", head: true })
    .eq("created_ip", ip)
    .gte("created_at", dayAgo);

  if (ipCountErr) {
    console.error("[public-preview] IP count failed:", ipCountErr.message);
    return NextResponse.json({ error: "Something went wrong. Try again in a moment." }, { status: 503 });
  }
  if ((ipCount ?? 0) >= PER_IP_DAILY) {
    return NextResponse.json(
      { error: `You've used your ${PER_IP_DAILY} free reports for today. Connect Twitch for full reports on your own streams.` },
      { status: 429 }
    );
  }

  // ---- 3. Global daily ceiling, failing closed -----------------------
  const { count: globalCount, error: globalErr } = await admin
    .from("public_previews")
    .select("id", { count: "exact", head: true })
    .gte("created_at", dayAgo);

  if (globalErr) {
    // Cannot prove we are under budget, so refuse. This is the branch
    // that protects the Deepgram balance when the database is unhappy.
    console.error("[public-preview] Global count failed, refusing:", globalErr.message);
    return NextResponse.json(
      { error: "Free reports are paused for a moment. Try again shortly." },
      { status: 503 }
    );
  }
  if ((globalCount ?? 0) >= GLOBAL_DAILY) {
    return NextResponse.json(
      {
        error:
          "Free reports are maxed out for today. Sign in with Twitch to analyze your own streams right now, or come back tomorrow.",
      },
      { status: 429 }
    );
  }

  // ---- 4. Twitch metadata -------------------------------------------
  let meta;
  try {
    meta = await fetchPreviewVodMeta(vodId);
  } catch (err) {
    console.error("[public-preview] Helix lookup failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Couldn't reach Twitch just now. Try again in a moment." },
      { status: 503 }
    );
  }

  if (!meta) {
    return NextResponse.json(
      { error: "Twitch doesn't have that VOD. It may be deleted, private, or subscriber-only." },
      { status: 404 }
    );
  }

  if (meta.durationSeconds > 0 && meta.durationSeconds < MIN_PREVIEW_SECONDS) {
    return NextResponse.json(
      { error: "That stream is under 5 minutes, which isn't enough to coach. Try a longer one." },
      { status: 400 }
    );
  }

  // ---- 5. Create (or reset) the row ---------------------------------
  const row = {
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
    created_ip: ip,
    created_at: new Date().toISOString(),
  };

  const { data: inserted, error: insertErr } = await admin
    .from("public_previews")
    .upsert(row, { onConflict: "twitch_vod_id" })
    .select("*")
    .single();

  if (insertErr || !inserted) {
    console.error("[public-preview] Insert failed:", insertErr?.message);
    return NextResponse.json({ error: "Something went wrong starting that report." }, { status: 500 });
  }

  // ---- 6. Queue it ---------------------------------------------------
  try {
    await inngest.send({
      // One job per attempt. A retry of a failed report reuses its row, and
      // so its id, and Inngest drops an event whose id it has seen in the
      // last 24 hours: with the row id alone, every retry sat on "pending"
      // forever. A double click never gets this far, the in-flight check
      // above hands back the running report first.
      id: `public-preview-${inserted.id}-${Date.parse(String(inserted.created_at)) || Date.now()}`,
      name: "public/preview",
      data: { previewId: inserted.id, twitchVodId: vodId, title: meta.title },
    });
  } catch (err) {
    console.error("[public-preview] Inngest send failed:", err instanceof Error ? err.message : err);
    await admin
      .from("public_previews")
      .update({ status: "failed", failed_reason: "Couldn't start the analysis. Try again." })
      .eq("id", inserted.id);
    return NextResponse.json({ error: "Couldn't start that report. Try again." }, { status: 503 });
  }

  return NextResponse.json({ ...previewPayload(inserted), via });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const vodId = url.searchParams.get("vod");
  if (!vodId || !/^\d{6,}$/.test(vodId)) {
    return NextResponse.json({ error: "Missing or malformed VOD id." }, { status: 400 });
  }

  // Polling is cheap and read-only, but still gated so nobody can use it
  // as a free scraper against our database.
  if (!rateLimit(`public-preview-poll:${ipFrom(request)}`, 240, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("public_previews")
    .select("*")
    .eq("twitch_vod_id", vodId)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ error: "No report for that VOD." }, { status: 404 });
  }

  // Surface stuck rows as failures so the page can offer a retry instead
  // of spinning forever if a job died without updating its row.
  if (
    (row.status === "pending" || row.status === "transcribing" || row.status === "analyzing") &&
    Date.now() - new Date(row.created_at as string).getTime() > STALE_MINUTES * 60 * 1000
  ) {
    return NextResponse.json({
      ...previewPayload(row),
      status: "failed",
      failed_reason: "That one took too long and timed out. Try running it again.",
    });
  }

  return NextResponse.json(previewPayload(row));
}
