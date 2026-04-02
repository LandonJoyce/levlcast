import { createClient } from "@/lib/supabase/server";
import { getYouTubeAuthUrl } from "@/lib/youtube";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // Generate a nonce and embed it in the state along with the userId.
  // The nonce is also stored in a short-lived httpOnly cookie.
  // On callback we verify both match — preventing forged state attacks.
  const nonce = randomUUID();
  const state = Buffer.from(JSON.stringify({ userId: user.id, nonce })).toString("base64");
  const authUrl = getYouTubeAuthUrl(state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("yt_oauth_nonce", nonce, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 600, // 10 minutes — enough time to complete OAuth
    path: "/",
  });

  return response;
}
