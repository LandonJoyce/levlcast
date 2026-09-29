import { createAdminClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import { after, NextResponse, type NextRequest } from "next/server";
import { sendWelcomeEmail, type FirstReport } from "@/lib/email";
import { fetchTwitchVods, getAppAccessToken, mapVodToRow, parseTwitchDuration } from "@/lib/twitch";
import { inngest } from "@/lib/inngest/client";
import { REF_COOKIE, REF_PATTERN, VISITOR_COOKIE } from "@/lib/funnel";
import { startWaitingPreview } from "@/lib/waiting-preview";

/**
 * How long a new sign-up's redirect waits for their streams to sync and
 * their first report to be queued. It's a few Twitch and database calls,
 * normally a second or two; past this the redirect goes out anyway and the
 * rest finishes in the background.
 */
const FIRST_REPORT_WAIT_MS = 6000;

/**
 * OAuth callback — exchanges the auth code for a session,
 * then upserts the user's Twitch profile data into our profiles table.
 * Uses admin client for the upsert to bypass RLS (session cookies
 * aren't fully set during the callback).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=no_code`);
  }

  // Create the redirect response first so we can attach cookies to it
  const response = NextResponse.redirect(`${origin}/dashboard`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options as never);
          });
        },
      },
    }
  );

  // Exchange code for session
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    console.error("Auth callback error:", error?.message);
    return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
  }


  // Extract Twitch data from the session
  const user = data.session.user;
  const meta = user.user_metadata;
  const providerToken = data.session.provider_token;
  const providerRefreshToken = data.session.provider_refresh_token;

  // Use admin client to bypass RLS for profile creation
  const admin = createAdminClient();

  // Check if this is a new user before upserting (upsert alone can't tell us)
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  const isNewUser = !existingProfile;

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: user.id,
      twitch_id: meta.provider_id || meta.sub,
      twitch_login: meta.name || meta.preferred_username || "",
      twitch_display_name: meta.nickname || meta.full_name || "",
      twitch_avatar_url: meta.avatar_url || meta.picture || "",
      twitch_access_token: providerToken || "",
      twitch_refresh_token: providerRefreshToken || "",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (profileError) {
    console.error("Profile upsert error:", profileError.message);
    // Profile failed — redirect to login with error so user sees a message
    // instead of landing on a broken dashboard with no profile row
    return NextResponse.redirect(`${origin}/auth/login?error=profile_failed`);
  }

  // Welcome email for new users, sent once we know whether their first
  // report started (it says which), in after() so it doesn't hold up the
  // redirect but still gets to finish: a promise nobody awaits isn't
  // guaranteed to run once the response has gone out.
  const welcome = async (firstReport: FirstReport) => {
    if (!isNewUser || !user.email) return;
    const displayName = meta.nickname || meta.full_name || meta.name || meta.preferred_username || "there";
    await sendWelcomeEmail(user.email, displayName, firstReport).catch((err) => {
      console.error("[auth/callback] Welcome email failed:", err instanceof Error ? err.message : err);
    });
  };

  // Sync a new streamer's VODs and start their first report, then send them
  // to the stream it's running on. That page shows the free report on the
  // stream's opening while the full one is made, so the first thing they
  // see after joining is their own stream.
  //
  // This used to be fire-and-forget with a redirect to the dashboard. The
  // redirect usually won the race, so the dashboard rendered before any
  // streams had synced and told them Twitch had no saved broadcasts. And
  // on Vercel, work nobody awaits isn't guaranteed to finish at all.
  if (isNewUser) {
    const twitchId = meta.provider_id || meta.sub;
    // A stream they previewed for free before signing up (set by the
    // preview's "Get my full report" button). If it's theirs, it's the one
    // to analyze first, since that's the report they asked for.
    const pendingVod = request.cookies.get("levlcast_pending_vod")?.value;
    const preferredVodId = pendingVod && /^\d{6,}$/.test(pendingVod) ? pendingVod : null;
    if (twitchId) {
      const queuing = autoAnalyzeFirstVod(user.id, twitchId, preferredVodId).catch((err) => {
        console.error("[auth/callback] Auto-analyze failed:", err instanceof Error ? err.message : err);
        return null;
      });
      // Anyone who didn't run the free report on this stream before
      // signing up gets it now, so there's something of theirs to read
      // in a minute or two instead of ten.
      after(async () => {
        const first = await queuing;
        if (first) {
          await startWaitingPreview(first.twitchVodId);
          await welcome("started");
          return;
        }
        // Nothing started: were there streams to start on? (The first-report
        // step saves every stream Twitch has for them before picking one.)
        const { count } = await admin.from("vods").select("id", { count: "exact", head: true }).eq("user_id", user.id);
        await welcome((count ?? 0) > 0 ? "pick" : "no_streams");
      });
      let timer: ReturnType<typeof setTimeout> | undefined;
      const first = await Promise.race([
        queuing,
        new Promise<"timeout">((resolve) => {
          timer = setTimeout(() => resolve("timeout"), FIRST_REPORT_WAIT_MS);
        }),
      ]);
      clearTimeout(timer);
      if (first === "timeout") {
        // Still syncing: the dashboard says so and refreshes until the
        // streams are in, instead of calling their Twitch empty.
        response.headers.set("Location", `${origin}/dashboard?syncing=1`);
      } else if (first) {
        response.headers.set("Location", `${origin}/dashboard/vods/${first.vodId}?welcome=1`);
      }
    } else {
      after(() => welcome("no_streams"));
    }
  }

  // Funnel: the last step. Only when the sign-in came back to the browser
  // that started it; on a phone Twitch can finish it somewhere else, and
  // those show up as a "Continue with Twitch" with no signup after it.
  if (isNewUser) {
    const visitor = request.cookies.get(VISITOR_COOKIE)?.value ?? `user-${user.id}`;
    const rawRef = (request.cookies.get(REF_COOKIE)?.value ?? "").toLowerCase();
    try {
      await admin.from("funnel_events").insert({
        visitor: visitor.slice(0, 64),
        ref: REF_PATTERN.test(rawRef) ? rawRef : null,
        event: "signup",
        detail: user.id,
      });
    } catch {
      // Before migration 033 the table doesn't exist.
    }
  }

  // One use only.
  response.cookies.set("levlcast_pending_vod", "", { maxAge: 0, path: "/" });
  return response;
}

/**
 * Pulls the user's recent Twitch VODs, picks the most recent eligible one
 * (between 10 min and 4 hours so it fits within free-tier rules), inserts
 * it into the vods table, and queues the analyze job. Returns the queued
 * stream, or null when nothing was queued. Failures are logged by the
 * caller.
 */
async function autoAnalyzeFirstVod(
  userId: string,
  twitchId: string,
  preferredVodId: string | null = null
): Promise<{ vodId: string; twitchVodId: string } | null> {
  const admin = createAdminClient();

  let appToken: string;
  try {
    appToken = await getAppAccessToken();
  } catch (err) {
    console.warn("[auth/callback/auto-analyze] App token failed:", err instanceof Error ? err.message : err);
    return null;
  }

  const vods = await fetchTwitchVods(twitchId, appToken, 20);
  if (vods.length === 0) return null;

  // Bulk-insert all recent VODs as pending so the dashboard isn't empty when
  // the user lands. The chosen VOD is then claimed and queued separately.
  // Skip any VOD with broken Twitch metadata so they never appear in the list.
  const rows = vods
    .map((v) => mapVodToRow(v, userId))
    .filter((r): r is NonNullable<typeof r> => r !== null);
  if (rows.length === 0) return null;
  const { error: insertErr } = await admin
    .from("vods")
    .upsert(rows, { onConflict: "twitch_vod_id" });
  if (insertErr) {
    console.warn("[auth/callback/auto-analyze] Bulk VOD insert failed:", insertErr.message);
    return null;
  }

  // Pick the VOD to analyze on signup.
  //
  // This used to require 10 minutes to 4 hours and give up entirely if
  // nothing fit. Real signups died on that. One user arrived with three
  // VODs, two of them over four hours, so the rule refused all of them and
  // their first impression of the product was an empty dashboard. A
  // streamer whose sessions run long is the LAST person we should be
  // silently skipping — they have the most to be coached on.
  //
  // The 4-hour ceiling was never a technical limit either. Transcription
  // chunks at 12 minutes, so length costs time, not correctness.
  //
  // Now: prefer a VOD in the comfortable range, but if none exists, fall
  // back to the longest one over the minimum rather than doing nothing.
  // Showing a report on a 5-hour stream beats showing nothing at all.
  const MIN_DURATION = 10 * 60;
  const PREFERRED_MAX = 4 * 60 * 60;

  const withDuration = vods
    .map((v) => ({ vod: v, dur: parseTwitchDuration(v.duration) }))
    .filter((x) => x.dur >= MIN_DURATION);

  // The stream they previewed before signing up comes first, if it's
  // one of theirs; otherwise the newest one in the comfortable range.
  const wanted = preferredVodId ? withDuration.find((x) => x.vod.id === preferredVodId) : undefined;
  const preferred = withDuration.find((x) => x.dur <= PREFERRED_MAX);
  const fallback = withDuration.sort((a, b) => a.dur - b.dur)[0];
  const eligible = (wanted ?? preferred ?? fallback)?.vod;

  if (!eligible) {
    console.log(
      `[auth/callback/auto-analyze] user ${userId} has ${vods.length} VODs but none over ${MIN_DURATION}s — nothing queued`
    );
    return null;
  }

  // Atomic claim: only flip status to transcribing if it's still pending
  const { data: claimed } = await admin
    .from("vods")
    .update({ status: "transcribing" })
    .eq("user_id", userId)
    .eq("twitch_vod_id", eligible.id)
    .eq("status", "pending")
    .select("id")
    .single();

  if (!claimed) return null;

  await inngest.send({
    // Idempotency key — if this same event fires twice (auth callback hit
    // twice, browser retried OAuth, etc.) Inngest dedupes within 24h so we
    // don't double-bill Claude on the same VOD.
    id: `vod-analyze-${claimed.id}`,
    name: "vod/analyze",
    data: { vodId: claimed.id, userId },
  });

  console.log(`[auth/callback/auto-analyze] Queued first analysis for new user ${userId} (vod ${claimed.id})`);
  return { vodId: claimed.id as string, twitchVodId: eligible.id };
}
