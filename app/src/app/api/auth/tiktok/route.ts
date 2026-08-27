import { createClient } from "@/lib/supabase/server";
import { getTikTokAuthUrl } from "@/lib/tiktok";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const nonce = crypto.randomUUID();
  const state = Buffer.from(JSON.stringify({ userId: user.id, nonce })).toString("base64");
  const authUrl = getTikTokAuthUrl(state);

  // Store nonce in a short-lived cookie so the callback can verify it
  const response = NextResponse.redirect(authUrl);
  response.cookies.set("tt_oauth_nonce", nonce, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutes
    path: "/",
  });
  return response;
}
