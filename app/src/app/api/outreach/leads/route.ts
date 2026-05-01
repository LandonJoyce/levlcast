import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const ADMIN_EMAIL = "landonjoyce@hotmail.com";

const PROMO_SUBS = new Set(["twitchfollowers", "newtwitchstreamers", "twitch_startup"]);

const HELP_INTENT_PHRASES = [
  "my stream", "my channel", "i stream", "i've been streaming",
  "started streaming", "just started streaming", "new streamer", "new to streaming",
  "how do i grow", "how to grow", "can't grow", "struggling to grow",
  "no viewers", "low viewers", "0 viewers", "zero viewers",
  "how do i get", "how to get viewers", "how to get followers",
  "feedback on my", "feedback for my", "roast my", "rate my",
  "any advice", "any tips", "any help", "need advice", "need help",
  "what am i doing wrong", "what should i",
  "trying to reach affiliate", "trying to get affiliate", "path to affiliate",
  "twitch.tv/",
];

const SKIP_AUTHORS = new Set(["automoderator", "[deleted]", "reddit"]);

let cachedToken: { token: string; expires: number } | null = null;

async function getRedditToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires) return cachedToken.token;

  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET not set in env");

  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "LevlCastOutreach/1.0 by /u/levlcast",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Reddit OAuth failed: ${res.status}`);
  const data = await res.json();

  cachedToken = { token: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedToken.token;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subreddit = req.nextUrl.searchParams.get("subreddit") ?? "TwitchStreamers";
  const sort = req.nextUrl.searchParams.get("sort") ?? "new";

  let token: string;
  try {
    token = await getRedditToken();
  } catch (e: any) {
    return NextResponse.json({ error: e.message, posts: [] });
  }

  let res: Response;
  try {
    res = await fetch(`https://oauth.reddit.com/r/${subreddit}/${sort}?limit=50&raw_json=1`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "LevlCastOutreach/1.0 by /u/levlcast",
      },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "Reddit unreachable", posts: [] });
  }

  if (!res.ok) return NextResponse.json({ error: `Reddit returned ${res.status}`, posts: [] });

  const data = await res.json();
  const children: any[] = data.data?.children ?? [];

  const isPromoSub = PROMO_SUBS.has(subreddit.toLowerCase());

  const posts = children
    .map((c: any) => ({
      id: c.data.id as string,
      title: c.data.title as string,
      body: (c.data.selftext as string)?.slice(0, 600) ?? "",
      author: c.data.author as string,
      subreddit: c.data.subreddit as string,
      url: `https://reddit.com${c.data.permalink}`,
      score: c.data.score as number,
      created: c.data.created_utc as number,
      flair: c.data.link_flair_text as string | null,
    }))
    .filter((p) => {
      if (SKIP_AUTHORS.has(p.author.toLowerCase())) return false;
      if (p.title === "[deleted]") return false;
      if (isPromoSub) return true;
      const text = `${p.title} ${p.body}`.toLowerCase();
      return HELP_INTENT_PHRASES.some((phrase) => text.includes(phrase));
    });

  return NextResponse.json({ posts, total: children.length, filtered: posts.length });
}
