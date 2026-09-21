import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { redditGet, isRedditConfigured, OUTREACH_SUBS } from "@/lib/reddit";

export const runtime = "edge";

const ADMIN_EMAIL = "landonjoyce@hotmail.com";

// Help-seeking language. A post/comment must contain one of these to surface
// as a lead, so we message people actually asking for help, not random
// Twitch mentions.
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

// Subs where any recent post is fair game (self-promo hubs) — skip the
// help-phrase filter there.
const PROMO_SUBS = new Set(["twitchfollowers", "newtwitchstreamers", "twitch_startup", "twitchstreaming"]);
const SKIP = new Set(["automoderator", "[deleted]", "reddit", "bmwdouche"]);
const SKIP_FLAIRS = new Set(["self promotion", "self-promotion", "promo", "advertisement"]);

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

  // No credential gate any more. redditGet falls back to Reddit's public
  // JSON endpoints when no OAuth app is configured, and reading public
  // subreddits has never actually required one. The gate was turning a
  // missing API app into a dead page when only sending needs credentials.

  // subreddit=all (or missing) pulls every sub we work in one combined request.
  // subreddit=name pulls just that one. No more Reddit-wide keyword search.
  const subParam = req.nextUrl.searchParams.get("subreddit");
  const useAll = !subParam || subParam.toLowerCase() === "all";
  const subPath = useAll ? OUTREACH_SUBS.join("+") : subParam!;
  const isPromo = !useAll && PROMO_SUBS.has(subParam!.toLowerCase());

  /**
   * Arctic Shift — a third-party Reddit mirror that needs no credentials.
   *
   * This is how the page worked before, and removing it in favour of Reddit
   * OAuth is what killed it: Reddit blocks credential-free reads from
   * datacenter IPs, so when the API keys went missing there was no path
   * left. The mirror has no such restriction.
   *
   * It runs roughly two weeks behind real time, which is why the recency
   * window below is generous rather than tight. Slightly stale leads beat
   * no leads.
   */
  const fetchFromMirror = async (sub: string): Promise<any[]> => {
    const r = await fetch(
      `https://arctic-shift.photon-reddit.com/api/posts/search?subreddit=${encodeURIComponent(sub)}&limit=100`,
      { headers: { "User-Agent": "LevlCast/1.0", Accept: "application/json" } }
    );
    if (!r.ok) throw new Error(`Mirror returned ${r.status}`);
    const j = await r.json();
    return (j?.data ?? []) as any[];
  };

  let children: any[] = [];
  try {
    // Prefer OAuth when it is configured: real time rather than mirrored.
    if (isRedditConfigured()) {
      const json = await redditGet(`/r/${encodeURIComponent(subPath)}/new?limit=100`);
      children = json?.data?.children ?? [];
    } else {
      // Mirror returns flat post objects, not Reddit's {kind, data} wrapper,
      // so wrap them to keep one shape downstream.
      const subs = useAll ? OUTREACH_SUBS : [subParam!];
      const results = await Promise.all(
        subs.map((s) => fetchFromMirror(s).catch(() => [] as any[]))
      );
      children = results.flat().map((d) => ({ data: d }));
      if (children.length === 0) {
        return NextResponse.json(
          { error: "Could not load any subreddits from the mirror. Try again shortly.", posts: [] },
          { status: 502 }
        );
      }
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Reddit fetch failed", posts: [] }, { status: 502 });
  }

  const seenAuthors = new Set<string>();
  // OAuth data is real-time, so we can use a tight, useful recency window.
  // The mirror lags about two weeks, so a 14-day window would return almost
  // nothing when running without OAuth. 30 days keeps the list populated.
  const recencyDays = isRedditConfigured() ? 14 : 30;
  const cutoffSec = (Date.now() - recencyDays * 24 * 60 * 60 * 1000) / 1000;

  const posts = children
    .map((c: any) => {
      const d = c.data ?? c;
      const sub = (d.subreddit as string) ?? subPath;
      return {
        id: d.id as string,
        title: d.title as string,
        body: ((d.selftext ?? "") as string).slice(0, 500),
        author: d.author as string,
        subreddit: sub,
        url: d.permalink ? `https://www.reddit.com${d.permalink}` : `https://reddit.com/r/${sub}/comments/${d.id}/`,
        created: (d.created_utc as number) ?? 0,
        flair: (d.link_flair_text as string | null) ?? null,
      };
    })
    .filter((p) => {
      if (!p.author || SKIP.has(p.author.toLowerCase())) return false;
      if (p.title === "[deleted]" || p.title === "[removed]") return false;
      if (seenAuthors.has(p.author)) return false;
      if (p.flair && SKIP_FLAIRS.has(p.flair.toLowerCase())) return false;
      if (!p.created || p.created < cutoffSec) return false;
      const text = `${p.title} ${p.body}`.toLowerCase();
      // Promo subs skip the phrase filter; everywhere else needs help language.
      const promoSub = isPromo || PROMO_SUBS.has((p.subreddit || "").toLowerCase());
      const passes = promoSub || HELP_PHRASES.some((ph) => text.includes(ph));
      if (!passes) return false;
      seenAuthors.add(p.author);
      return true;
    })
    .sort((a, b) => b.created - a.created)
    .slice(0, 80);

  return NextResponse.json({ posts });
}
