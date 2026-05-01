import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const runtime = "edge";

const ADMIN_EMAIL = "landonjoyce@hotmail.com";

async function getTwitchToken(): Promise<string> {
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID!,
      client_secret: process.env.TWITCH_CLIENT_SECRET!,
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) throw new Error(`Twitch auth failed: ${res.status}`);
  const data = await res.json();
  return data.access_token as string;
}

export async function GET(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return req.cookies.getAll(); }, setAll() {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const game = req.nextUrl.searchParams.get("game") ?? "";

  let token: string;
  try {
    token = await getTwitchToken();
  } catch (e: any) {
    return NextResponse.json({ error: e.message, posts: [] });
  }

  const headers = {
    "Client-ID": process.env.TWITCH_CLIENT_ID!,
    Authorization: `Bearer ${token}`,
  };

  // If a game name was given, resolve it to a game_id first
  let gameId = "";
  if (game) {
    const gRes = await fetch(
      `https://api.twitch.tv/helix/games?name=${encodeURIComponent(game)}`,
      { headers }
    );
    const gData = await gRes.json();
    gameId = gData.data?.[0]?.id ?? "";
  }

  // Fetch live streams: small viewer counts (no min — Twitch sorts by viewers desc,
  // so we take the last page by fetching with first=100 then filtering)
  const url = gameId
    ? `https://api.twitch.tv/helix/streams?first=100&game_id=${gameId}`
    : `https://api.twitch.tv/helix/streams?first=100`;

  const sRes = await fetch(url, { headers });
  if (!sRes.ok) return NextResponse.json({ error: `Twitch streams failed: ${sRes.status}`, posts: [] });
  const sData = await sRes.json();
  const streams: any[] = sData.data ?? [];

  // We want small streamers — under 50 viewers
  const leads = streams
    .filter((s) => s.viewer_count <= 50 && s.viewer_count >= 0 && s.language === "en")
    .map((s) => ({
      id: s.id,
      title: s.title,
      body: `Live now playing ${s.game_name} with ${s.viewer_count} viewer${s.viewer_count === 1 ? "" : "s"}.`,
      author: s.user_name,
      subreddit: s.game_name,
      url: `https://twitch.tv/${s.user_login}`,
      viewers: s.viewer_count,
      game: s.game_name,
      created: Math.floor(new Date(s.started_at).getTime() / 1000),
      flair: `${s.viewer_count} viewers`,
    }));

  return NextResponse.json({ posts: leads, total: streams.length });
}
