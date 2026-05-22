import { createClientFromRequest, createAdminClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { getUserUsage } from "@/lib/limits";
import { getAppAccessToken, mapVodToRow, parseTwitchDuration, refreshTwitchToken } from "@/lib/twitch";
import { inngest } from "@/lib/inngest/client";
import { NextResponse } from "next/server";

/** Max accepted URL length — guards against unreasonably long input being POSTed. */
const MAX_URL_LENGTH = 500;

const HELIX_BASE = "https://api.twitch.tv/helix";

/**
 * POST /api/twitch/vods/analyze-by-url
 *
 * Body: { url: string }
 *
 * Used by the landing-page URL paste flow. A visitor types a Twitch VOD URL,
 * signs in with Twitch, and lands on /dashboard where this endpoint gets
 * called with their pending URL. The flow:
 *   1. Extract the VOD ID from a twitch.tv/videos/<id> URL.
 *   2. Verify the VOD's broadcaster matches the signed-in user (we don't
 *      let people analyze other people's streams — Twitch tokens prove
 *      ownership and that's the security boundary).
 *   3. Fetch VOD metadata from Helix, insert it into our `vods` table.
 *   4. Atomically claim the row and fire the analyze Inngest event.
 *
 * Returns the inserted vod id on success so the client can redirect to
 * the live progress page.
 */
export async function POST(request: Request) {
  const supabase = await createClientFromRequest(request);
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 5 per hour per user. This endpoint actually queues an analysis (cost),
  // so we keep it tighter than the regular sync limit.
  if (!rateLimit(`analyze-by-url:${user.id}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawUrl = body.url;
  if (typeof rawUrl !== "string") {
    return NextResponse.json({ error: "Missing URL" }, { status: 400 });
  }
  if (rawUrl.length > MAX_URL_LENGTH) {
    return NextResponse.json({ error: "URL is too long." }, { status: 400 });
  }
  const url = rawUrl.trim();
  if (!url) {
    return NextResponse.json({ error: "Missing URL" }, { status: 400 });
  }

  const vodId = extractVodId(url);
  if (!vodId) {
    return NextResponse.json(
      { error: "That doesn't look like a Twitch VOD link. Paste a URL like https://www.twitch.tv/videos/1234567890." },
      { status: 400 }
    );
  }

  // Enforce per-plan analysis quota BEFORE doing any external API work.
  // Mirrors the check in /api/vods/analyze so the URL-paste flow can't be
  // used to bypass the free-trial 3-VOD cap or the Pro/Founding hour cap.
  const usage = await getUserUsage(user.id, supabase);
  if (!usage.can_analyze) {
    let message: string;
    if (usage.on_trial) {
      message = `You've used all ${usage.analyses_limit} analyses on your free trial. Subscribe to keep analyzing streams.`;
    } else if (usage.block_reason === "hours_cap") {
      message = `You've used ${usage.hours_used}h of your ${usage.hours_limit}h monthly analysis budget. Resets at the start of next month.`;
    } else {
      message = `You've used all ${usage.analyses_limit} analyses for this month.`;
    }
    return NextResponse.json({ error: message, limit_reached: true }, { status: 403 });
  }

  const admin = createAdminClient();

  // Get profile + tokens. Twitch app token is fine for fetching public VOD
  // metadata, but we cross-check that the broadcaster matches the signed-in
  // user's twitch_id so people can't analyze someone else's stream.
  const { data: profile } = await admin
    .from("profiles")
    .select("twitch_id, twitch_access_token, twitch_refresh_token")
    .eq("id", user.id)
    .single();

  if (!profile?.twitch_id) {
    return NextResponse.json(
      { error: "Twitch is still connecting. Give it a minute after signup, then try again." },
      { status: 400 }
    );
  }

  // Fetch VOD metadata. Prefer user token, fall back to refresh, then app token.
  let vodMeta: TwitchVideoRow | null = null;
  let lastErr: string | null = null;

  if (profile.twitch_access_token) {
    try {
      vodMeta = await fetchVodById(vodId, profile.twitch_access_token);
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  if (!vodMeta && profile.twitch_refresh_token) {
    try {
      const refreshed = await refreshTwitchToken(profile.twitch_refresh_token);
      await admin.from("profiles").update({
        twitch_access_token: refreshed.accessToken,
        twitch_refresh_token: refreshed.refreshToken,
      }).eq("id", user.id);
      vodMeta = await fetchVodById(vodId, refreshed.accessToken);
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  if (!vodMeta) {
    try {
      const appToken = await getAppAccessToken();
      vodMeta = await fetchVodById(vodId, appToken);
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }

  if (!vodMeta) {
    return NextResponse.json(
      { error: "Couldn't find that VOD on Twitch. It may have been deleted or set to private.", detail: lastErr },
      { status: 404 }
    );
  }

  // Ownership check — broadcaster must match the signed-in user's twitch_id
  if (vodMeta.user_id !== profile.twitch_id) {
    return NextResponse.json(
      { error: "That VOD belongs to a different Twitch channel. You can only analyze your own streams." },
      { status: 403 }
    );
  }

  // Per-plan duration cap. Free trial: 4h. Pro / Founding: 8h. Pro Plus: 10h
  // (matches the chunked-transcription pipeline's tested ceiling). The cap
  // exists because while chunking handles long streams, each additional hour
  // adds Deepgram + Claude cost, and we want plan-aligned ceilings.
  const dur = parseTwitchDuration(vodMeta.duration);
  const maxDuration = usage.on_trial
    ? 4 * 60 * 60
    : usage.pro_plus
    ? 10 * 60 * 60
    : 8 * 60 * 60;
  if (dur > maxDuration) {
    let message: string;
    if (usage.on_trial) {
      message = "That stream is over 4 hours. Free analysis is capped at 4 hours — go Pro to analyze longer streams.";
    } else if (usage.pro_plus) {
      message = "That stream is over 10 hours. We can't reliably transcribe streams longer than 10 hours yet.";
    } else {
      message = "That stream is over 8 hours. Pro caps per-stream at 8h. Upgrade to Pro Plus for streams up to 10 hours.";
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
  if (dur < 5 * 60) {
    return NextResponse.json(
      { error: "That stream is under 5 minutes. There's not enough to coach yet — try a longer one." },
      { status: 400 }
    );
  }

  // Upsert the VOD as pending. If the row already exists and is already
  // analyzed, just return its id so the client can navigate there.
  const row = mapVodToRow(vodMeta, user.id);
  if (!row) {
    return NextResponse.json(
      { error: "That VOD's metadata looks broken on Twitch's end (impossible duration). Try a different VOD." },
      { status: 400 }
    );
  }
  const { data: upserted, error: upsertErr } = await admin
    .from("vods")
    .upsert(row, { onConflict: "twitch_vod_id" })
    .select("id, status")
    .single();

  if (upsertErr || !upserted) {
    console.error("[analyze-by-url] Upsert failed:", upsertErr?.message);
    return NextResponse.json({ error: "Failed to save VOD" }, { status: 500 });
  }

  // If it's already analyzed, skip re-queueing
  if (upserted.status === "ready") {
    return NextResponse.json({ vodId: upserted.id, alreadyAnalyzed: true });
  }

  // Atomic claim — only flip to transcribing if still pending
  const { data: claimed } = await admin
    .from("vods")
    .update({ status: "transcribing" })
    .eq("id", upserted.id)
    .eq("status", "pending")
    .select("id")
    .single();

  if (!claimed) {
    // Already in progress (transcribing/analyzing) — that's fine, return the id
    return NextResponse.json({ vodId: upserted.id, alreadyInProgress: true });
  }

  await inngest.send({
    name: "vod/analyze",
    data: { vodId: claimed.id, userId: user.id },
  });

  return NextResponse.json({ vodId: claimed.id, queued: true });
}

interface TwitchVideoRow {
  id: string;
  user_id: string;
  title: string;
  duration: string;
  created_at: string;
  thumbnail_url: string;
  view_count: number;
  stream_id: string | null;
}

async function fetchVodById(vodId: string, accessToken: string): Promise<TwitchVideoRow | null> {
  const clientId = process.env.TWITCH_CLIENT_ID!;
  const res = await fetch(`${HELIX_BASE}/videos?id=${vodId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Client-Id": clientId,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Twitch API ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  return (json.data?.[0] as TwitchVideoRow | undefined) ?? null;
}

/**
 * Extract a Twitch VOD ID from any of the common URL shapes:
 *   https://www.twitch.tv/videos/1234567890
 *   https://twitch.tv/videos/1234567890?t=01h02m
 *   twitch.tv/videos/1234567890
 *   1234567890 (raw ID)
 */
function extractVodId(input: string): string | null {
  const trimmed = input.trim();
  // Raw numeric ID
  if (/^\d{6,}$/.test(trimmed)) return trimmed;
  const m = trimmed.match(/twitch\.tv\/videos\/(\d{6,})/i);
  return m?.[1] ?? null;
}
