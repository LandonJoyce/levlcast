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
  const sort = req.nextUrl.searchParams.get("sort") ?? "new";

  let res: Response;
  try {
    res = await fetch(
      `https://www.reddit.com/r/${subreddit}/${sort}.json?limit=50&raw_json=1`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; LevlCast/1.0)",
          "Accept": "application/json",
        },
      }
    );
  } catch {
    return NextResponse.json({ error: "Reddit unreachable", posts: [] });
  }

  if (!res.ok) {
    return NextResponse.json({ error: `Reddit returned ${res.status}`, posts: [] });
  }

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: `Reddit returned non-JSON: ${text.slice(0, 150)}`, posts: [] });
  }

  const children: any[] = data.data?.children ?? [];
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
