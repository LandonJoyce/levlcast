import { createAdminClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { sendWelcomeEmail } from "@/lib/email";
import { fetchTwitchVods, getAppAccessToken, mapVodToRow, parseTwitchDuration } from "@/lib/twitch";
import { inngest } from "@/lib/inngest/client";

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

  // Fire welcome email for new users — don't await so it doesn't block the redirect
  if (isNewUser && user.email) {
    const displayName = meta.nickname || meta.full_name || meta.name || meta.preferred_username || "there";
    sendWelcomeEmail(user.email, displayName).catch((err) => {
      console.error("[auth/callback] Welcome email failed:", err instanceof Error ? err.message : err);
    });
  }

  // Auto-sync VODs and queue the most recent one for analysis on new signups.
  // This kills the activation gap: by the time the user lands on the dashboard,
  // their first coach report is already being generated. Fire and forget so a
  // Twitch API hiccup never breaks signup.
  if (isNewUser) {
    const twitchId = meta.provider_id || meta.sub;
    if (twitchId) {
      autoAnalyzeFirstVod(user.id, twitchId).catch((err) => {
        console.error("[auth/callback] Auto-analyze failed:", err instanceof Error ? err.message : err);
      });
    }
  }

  return response;
}

/**
 * Pulls the user's recent Twitch VODs, picks the most recent eligible one
 * (between 10 min and 4 hours so it fits within free-tier rules), inserts
 * it into the vods table, and queues the analyze job. Best-effort — failures
 * are logged but never thrown.
 */
async function autoAnalyzeFirstVod(userId: string, twitchId: string): Promise<void> {
  const admin = createAdminClient();

  let appToken: string;
  try {
    appToken = await getAppAccessToken();
  } catch (err) {
    console.warn("[auth/callback/auto-analyze] App token failed:", err instanceof Error ? err.message : err);
    return;
  }

  const vods = await fetchTwitchVods(twitchId, appToken, 20);
  if (vods.length === 0) return;

  // Bulk-insert all recent VODs as pending so the dashboard isn't empty when
  // the user lands. The chosen VOD is then claimed and queued separately.
  const rows = vods.map((v) => mapVodToRow(v, userId));
  const { error: insertErr } = await admin
    .from("vods")
    .upsert(rows, { onConflict: "twitch_vod_id" });
  if (insertErr) {
    console.warn("[auth/callback/auto-analyze] Bulk VOD insert failed:", insertErr.message);
    return;
  }

  // 10 min minimum to skip test streams — pipeline enforces its own duration limits
  const MIN_DURATION = 10 * 60;
  const eligible = vods.find((v) => {
    const dur = parseTwitchDuration(v.duration);
    return dur >= MIN_DURATION;
  });

  if (!eligible) return;

  // Atomic claim: only flip status to transcribing if it's still pending
  const { data: claimed } = await admin
    .from("vods")
    .update({ status: "transcribing" })
    .eq("user_id", userId)
    .eq("twitch_vod_id", eligible.id)
    .eq("status", "pending")
    .select("id")
    .single();

  if (!claimed) return;

  await inngest.send({
    name: "vod/analyze",
    data: { vodId: claimed.id, userId },
  });

  console.log(`[auth/callback/auto-analyze] Queued first analysis for new user ${userId} (vod ${claimed.id})`);
}
