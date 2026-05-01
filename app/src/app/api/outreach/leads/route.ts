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

  // Arctic Shift: free Reddit mirror API, no credentials, works from cloud IPs
  const res = await fetch(
    `https://arctic-shift.photon-reddit.com/api/posts/search?subreddit=${encodeURIComponent(subreddit)}&limit=100`,
    { headers: { "User-Agent": "LevlCast/1.0", Accept: "application/json" } }
  );

  if (!res.ok) {
    return NextResponse.json({ error: `Arctic Shift ${res.status} on r/${subreddit}`, posts: [] });
  }

  const data = await res.json();
  const children: any[] = data.data ?? [];
  const isPromo = PROMO_SUBS.has(subreddit.toLowerCase());
  const seenAuthors = new Set<string>();

  const posts = children
    .map((c: any) => ({
      id: c.id as string,
      title: c.title as string,
      body: ((c.selftext ?? c.body ?? "") as string).slice(0, 500),
      author: c.author as string,
      subreddit: (c.subreddit as string) ?? subreddit,
      url: c.url?.startsWith("https://www.reddit.com") ? c.url : `https://reddit.com/r/${c.subreddit ?? subreddit}/comments/${c.id}/`,
      created: typeof c.created_utc === "string" ? parseInt(c.created_utc, 10) : (c.created_utc as number) ?? 0,
      flair: (c.link_flair_text as string | null) ?? null,
    }))
    .filter((p) => {
      if (!p.author || SKIP.has(p.author.toLowerCase())) return false;
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
