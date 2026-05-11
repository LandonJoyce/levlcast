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

// Subs to fan out title-searches across when running a Reddit-wide query.
// Curated to streamer-adjacent communities + content-creator subs + the big
// game subs where small streamers regularly post about their channels.
// Reddit blocks unauthed cloud IPs from /search.json so we can't do a true
// Reddit-wide search; this list is the practical substitute.
const SEARCH_FANOUT_SUBS = [
  "TwitchStreamers", "Twitch_Startup", "SmallStreamers", "Twitch", "streaming",
  "ContentCreators", "NewTubers", "PartneredYoutube",
  "letsplay", "gaming", "pcgaming",
  "VALORANT", "leagueoflegends", "DestinyTheGame", "MonsterHunter",
  "Genshin_Impact", "Minecraft", "Fortnite", "DotA2", "Overwatch",
];

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

  // Subreddit mode: single Arctic Shift call.
  // Search mode: fan out title-searches across SEARCH_FANOUT_SUBS in parallel
  // and aggregate. Arctic Shift's text endpoints only work when scoped to a
  // subreddit, and Reddit's own search.json 403s from Vercel cloud IPs, so
  // fan-out is the practical Reddit-wide search.
  let children: any[] = [];

  if (q) {
    const fetches = SEARCH_FANOUT_SUBS.map(async (sub) => {
      const u = `https://arctic-shift.photon-reddit.com/api/posts/search?subreddit=${encodeURIComponent(sub)}&title=${encodeURIComponent(q)}&limit=25`;
      try {
        const r = await fetch(u, {
          headers: { "User-Agent": "LevlCast/1.0", Accept: "application/json" },
        });
        if (!r.ok) return [] as any[];
        const j = await r.json();
        return (j?.data ?? []) as any[];
      } catch {
        return [] as any[];
      }
    });
    const results = await Promise.all(fetches);
    children = results.flat();
    if (children.length === 0) {
      return NextResponse.json({
        error: `No results for "${q}" across ${SEARCH_FANOUT_SUBS.length} subs`,
        posts: [],
      });
    }
  } else {
    const r = await fetch(
      `https://arctic-shift.photon-reddit.com/api/posts/search?subreddit=${encodeURIComponent(subreddit!)}&limit=100`,
      { headers: { "User-Agent": "LevlCast/1.0", Accept: "application/json" } }
    );
    if (!r.ok) {
      return NextResponse.json({ error: `Arctic Shift ${r.status} on r/${subreddit}`, posts: [] });
    }
    const j = await r.json();
    children = j?.data ?? [];
  }
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
    })
    // Newest first. Fan-out from multiple subs interleaves their feeds, so
    // we sort here rather than trusting per-sub order.
    .sort((a, b) => b.created - a.created)
    .slice(0, 80);

  return NextResponse.json({ posts });
}
