import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const runtime = "edge";

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

export async function GET(req: NextRequest) {
  // Edge-compatible Supabase auth via cookies on the request
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll() {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subreddit = req.nextUrl.searchParams.get("subreddit") ?? "TwitchStreamers";

  // Pullpush mirrors Reddit without requiring auth and works from any server
  let res: Response;
  try {
    res = await fetch(
      `https://api.pullpush.io/reddit/search/submission?subreddit=${subreddit}&size=50&sort_type=created_utc&order=desc`,
      { headers: { "Accept": "application/json" } }
    );
  } catch {
    return NextResponse.json({ error: "Pullpush unreachable", posts: [] });
  }

  if (!res.ok) {
    return NextResponse.json({ error: `Pullpush returned ${res.status}`, posts: [] });
  }

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: `Unexpected response: ${text.slice(0, 150)}`, posts: [] });
  }

  // Pullpush returns { data: [...] } where each item is a flat post object
  const children: any[] = (data.data ?? []).map((p: any) => ({ data: p }));
  const isPromoSub = PROMO_SUBS.has(subreddit.toLowerCase());
  const seenAuthors = new Set<string>();

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
      if (seenAuthors.has(p.author)) return false;
      const text = `${p.title} ${p.body}`.toLowerCase();
      const passes = isPromoSub || HELP_INTENT_PHRASES.some((phrase) => text.includes(phrase));
      if (!passes) return false;
      seenAuthors.add(p.author);
      return true;
    });

  return NextResponse.json({ posts, total: children.length, filtered: posts.length });
}
