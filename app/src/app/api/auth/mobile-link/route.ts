import { createClientFromRequest, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/auth/mobile-link
 *
 * Stores the Twitch provider tokens for a mobile-signup user. Mobile login
 * runs `supabase.auth.exchangeCodeForSession` client-side, which means the
 * provider's access/refresh tokens only exist for an instant on the device
 * and never reach our server through the normal auth flow. This endpoint
 * accepts those tokens from the mobile client and persists them on the
 * profile so they can be used to fetch age-gated VODs (Twitch hides 18+
 * channel VODs from anonymous app tokens).
 *
 * Idempotent — safe to call multiple times. Skips the write silently if
 * tokens aren't provided.
 */
export async function POST(request: Request) {
  const supabase = await createClientFromRequest(request);

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { provider_token?: string; provider_refresh_token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const providerToken = body.provider_token?.trim();
  const providerRefreshToken = body.provider_refresh_token?.trim();

  if (!providerToken && !providerRefreshToken) {
    return NextResponse.json({ stored: false, reason: "no_tokens" });
  }

  const meta = user.user_metadata as Record<string, string | undefined>;
  const twitchId = meta?.provider_id || meta?.sub;

  const admin = createAdminClient();
  const { error: upsertErr } = await admin.from("profiles").upsert(
    {
      id: user.id,
      ...(twitchId ? {
        twitch_id: twitchId,
        twitch_login: meta?.name || meta?.preferred_username || "",
        twitch_display_name: meta?.nickname || meta?.full_name || "",
        twitch_avatar_url: meta?.avatar_url || meta?.picture || "",
      } : {}),
      ...(providerToken ? { twitch_access_token: providerToken } : {}),
      ...(providerRefreshToken ? { twitch_refresh_token: providerRefreshToken } : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (upsertErr) {
    console.error("[auth/mobile-link] Upsert failed:", upsertErr.message);
    return NextResponse.json({ error: "Failed to save tokens" }, { status: 500 });
  }

  return NextResponse.json({ stored: true });
}
