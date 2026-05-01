import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const runtime = "edge";

const ADMIN_EMAIL = "landonjoyce@hotmail.com";

const HELP_PHRASES = [
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

const PROMO_SUBS = new Set(["twitchfollowers", "newtwitchstreamers", "twitch_startup"]);
const SKIP = new Set(["automoderator", "[deleted]", "reddit"]);

async function getRedditToken(): Promise<string> {
  const credentials = btoa(
    `${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`
  );
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "LevlCast/1.0",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Reddit auth failed: ${res.status}`);
  const data = await res.json();
  if (!data.access_token) throw new Error("No access token in Reddit response");
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

  const subreddit = req.nextUrl.searchParams.get("subreddit") ?? "TwitchStreamers";

  let token: string;
  try {
    token = await getRedditToken();
  } catch (e: any) {
    return NextResponse.json({ error: e.message, posts: [] });
  }

  const res = await fetch(
    `https://oauth.reddit.com/r/${subreddit}/new?limit=100&raw_json=1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "LevlCast/1.0",
        Accept: "application/json",
      },
    }
  );

  if (!res.ok) {
    return NextResponse.json({ error: `Reddit ${res.status} on r/${subreddit}`, posts: [] });
  }

  const data = await res.json();
  const children: any[] = data.data?.children ?? [];
  const isPromo = PROMO_SUBS.has(subreddit.toLowerCase());
  const seenAuthors = new Set<string>();

  const posts = children
    .map((c: any) => ({
      id: c.data.id,
      title: c.data.title as string,
      body: (c.data.selftext as string)?.slice(0, 500) ?? "",
      author: c.data.author as string,
      subreddit: c.data.subreddit as string,
      url: `https://reddit.com${c.data.permalink}`,
      created: c.data.created_utc as number,
      flair: c.data.link_flair_text as string | null,
    }))
    .filter((p) => {
      if (SKIP.has(p.author.toLowerCase())) return false;
      if (p.title === "[deleted]") return false;
      if (seenAuthors.has(p.author)) return false;
      const text = `${p.title} ${p.body}`.toLowerCase();
      const passes = isPromo || HELP_PHRASES.some((ph) => text.includes(ph));
      if (!passes) return false;
      seenAuthors.add(p.author);
      return true;
    });

  return NextResponse.json({ posts });
}
