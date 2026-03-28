import { exchangeYouTubeCode } from "@/lib/youtube";
import { createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(new URL("/dashboard/connections?error=missing_params", req.url));
  }

  const userId = Buffer.from(state, "base64").toString("utf-8");

  try {
    const tokens = await exchangeYouTubeCode(code);

    if (!tokens.access_token) {
      throw new Error("No access token returned");
    }

    const supabase = createAdminClient();
    await supabase.from("social_connections").upsert({
      user_id: userId,
      platform: "youtube",
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      expires_at: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,platform" });

    return NextResponse.redirect(new URL("/dashboard/connections?success=youtube", req.url));
  } catch (e: any) {
    console.error("YouTube OAuth error:", e);
    return NextResponse.redirect(new URL("/dashboard/connections?error=oauth_failed", req.url));
  }
}
