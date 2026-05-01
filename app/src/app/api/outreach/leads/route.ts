import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const ADMIN_EMAIL = "landonjoyce@hotmail.com";

// These subs are pure streamer self-promotion — every post is a lead, no filter needed
const PROMO_SUBS = new Set(["twitchfollowers", "newtwitchstreamers", "twitch_startup"]);

// These subs mix streamers and viewers — only keep posts where someone is clearly seeking help
const HELP_INTENT_PHRASES = [
  "my stream", "my channel", "i stream", "i've been streaming", "i've been streaming",
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subreddit = req.nextUrl.searchParams.get("subreddit") ?? "TwitchStreamers";
  const sort = req.nextUrl.searchParams.get("sort") ?? "new";

  const url = `https://www.reddit.com/r/${subreddit}/${sort}.json?limit=50&raw_json=1`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": "LevlCastOutreach/1.0" },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "Reddit unreachable", posts: [] });
  }

  if (!res.ok) {
    return NextResponse.json({ error: `Reddit returned ${res.status}`, posts: [] });
  }

  const data = await res.json();
  const children: any[] = data.data?.children ?? [];

  const subLower = subreddit.toLowerCase();
  const isPromoSub = PROMO_SUBS.has(subLower);

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
      // Promo subs: every post is a streamer
      if (isPromoSub) return true;
      // All other subs: require a phrase that shows they are a streamer seeking help
      const text = `${p.title} ${p.body}`.toLowerCase();
      return HELP_INTENT_PHRASES.some((phrase) => text.includes(phrase));
    });

  return NextResponse.json({ posts, total: children.length, filtered: posts.length });
}
