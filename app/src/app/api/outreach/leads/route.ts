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

  // Two modes:
  //   ?subreddit=X  → fetch the 100 newest posts in that sub, filter by phrases
  //   ?q=text       → search ALL of Reddit for posts matching the text, then
  //                    apply the same streamer-phrase filter
  // The q path is the real value here. The subreddit path is only useful for
  // niche subs we know are active; most streamer subs are dead, so casting
  // wider via text search catches people in r/gaming, r/letsplay alts, the
  // big general game subs (r/valorant, r/destiny2 etc), and so on.
  const subreddit = req.nextUrl.searchParams.get("subreddit");
  const q = req.nextUrl.searchParams.get("q");

  if (!subreddit && !q) {
    return NextResponse.json({ error: "Pass either ?subreddit=name or ?q=search-text", posts: [] }, { status: 400 });
  }

  // Build the Arctic Shift URL for whichever mode the caller picked.
  // Arctic Shift mirrors the full Reddit corpus; ?q is a substring search
  // over title + selftext, sorted desc by created_utc when not specified.
  const url = q
    ? `https://arctic-shift.photon-reddit.com/api/posts/search?q=${encodeURIComponent(q)}&limit=100&sort=desc`
    : `https://arctic-shift.photon-reddit.com/api/posts/search?subreddit=${encodeURIComponent(subreddit!)}&limit=100`;

  const res = await fetch(url, {
    headers: { "User-Agent": "LevlCast/1.0", Accept: "application/json" },
  });

  if (!res.ok) {
    return NextResponse.json({
      error: `Arctic Shift ${res.status} on ${q ? `q="${q}"` : `r/${subreddit}`}`,
      posts: [],
    });
  }

  const data = await res.json();
  const children: any[] = data.data ?? [];
  const isPromo = !q && subreddit && PROMO_SUBS.has(subreddit.toLowerCase());
  const seenAuthors = new Set<string>();

  // Some massive default subs are full of unrelated noise even when the
  // search text matches. Skip them in q-mode so the list stays signal-heavy.
  const NOISE_SUBS = new Set(["all", "popular", "askreddit", "memes", "funny", "pics", "videos", "gifs", "todayilearned"]);

  const posts = children
    .map((c: any) => {
      const sub = (c.subreddit as string) ?? subreddit ?? "";
      return {
        id: c.id as string,
        title: c.title as string,
        body: ((c.selftext ?? c.body ?? "") as string).slice(0, 500),
        author: c.author as string,
        subreddit: sub,
        url: c.url?.startsWith("https://www.reddit.com")
          ? c.url
          : `https://reddit.com/r/${sub}/comments/${c.id}/`,
        created: typeof c.created_utc === "string" ? parseInt(c.created_utc, 10) : (c.created_utc as number) ?? 0,
        flair: (c.link_flair_text as string | null) ?? null,
      };
    })
    .filter((p) => {
      if (!p.author || SKIP.has(p.author.toLowerCase())) return false;
      if (p.title === "[deleted]") return false;
      if (seenAuthors.has(p.author)) return false;
      if (q && p.subreddit && NOISE_SUBS.has(p.subreddit.toLowerCase())) return false;
      const text = `${p.title} ${p.body}`.toLowerCase();
      // Promo subs skip the phrase filter. q-mode posts still need a phrase
      // match because the Reddit-wide search has too many false positives
      // for a single keyword (e.g. someone tweeting about watching Twitch).
      const passes = isPromo || HELP_PHRASES.some((ph) => text.includes(ph));
      if (!passes) return false;
      seenAuthors.add(p.author);
      return true;
    });

  return NextResponse.json({ posts });
}
