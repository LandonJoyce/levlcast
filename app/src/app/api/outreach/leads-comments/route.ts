import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { redditGet, isRedditConfigured, OUTREACH_SUBS } from "@/lib/reddit";

export const runtime = "edge";

const ADMIN_EMAIL = "landonjoyce@hotmail.com";
const SKIP = new Set(["automoderator", "[deleted]", "reddit", "bmwdouche"]);

// Same help-seeking language as posts — filter comment bodies.
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

  // No credential gate: redditGet reads Reddit's public JSON endpoints
  // when no OAuth app is configured. Only sending needs credentials.

  const subParam = req.nextUrl.searchParams.get("subreddit");
  const useAll = !subParam || subParam.toLowerCase() === "all";
  const subPath = useAll ? OUTREACH_SUBS.join("+") : subParam!;

  /** Same credential-free mirror the posts route uses. See that file. */
  const fetchCommentsFromMirror = async (sub: string): Promise<any[]> => {
    const r = await fetch(
      `https://arctic-shift.photon-reddit.com/api/comments/search?subreddit=${encodeURIComponent(sub)}&limit=100`,
      { headers: { "User-Agent": "LevlCast/1.0", Accept: "application/json" } }
    );
    if (!r.ok) throw new Error(`Mirror returned ${r.status}`);
    const j = await r.json();
    return (j?.data ?? []) as any[];
  };

  let children: any[] = [];
  try {
    if (isRedditConfigured()) {
      // /comments gives the newest comments across the sub(s).
      const json = await redditGet(`/r/${encodeURIComponent(subPath)}/comments?limit=100`);
      children = json?.data?.children ?? [];
    } else {
      const subs = useAll ? OUTREACH_SUBS : [subParam!];
      const results = await Promise.all(
        subs.map((s) => fetchCommentsFromMirror(s).catch(() => [] as any[]))
      );
      children = results.flat().map((d) => ({ data: d }));
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Reddit fetch failed", comments: [] }, { status: 502 });
  }

  const seenAuthors = new Set<string>();
  // Mirror data lags, so widen the window when running without OAuth.
  const cutoffSec = (Date.now() - (isRedditConfigured() ? 14 : 30) * 24 * 60 * 60 * 1000) / 1000;

  const comments = children
    .map((c: any) => {
      const d = c.data ?? c;
      const postId = typeof d.link_id === "string" ? d.link_id.replace(/^t3_/, "") : String(d.link_id ?? "");
      const sub = (d.subreddit as string) ?? subPath;
      return {
        id: d.id as string,
        title: null as string | null,
        body: ((d.body ?? "") as string).slice(0, 600),
        author: d.author as string,
        subreddit: sub,
        url: d.permalink
          ? `https://www.reddit.com${d.permalink}`
          : `https://www.reddit.com/r/${sub}/comments/${postId}/_/${d.id}/`,
        created: (d.created_utc as number) ?? 0,
        flair: null as string | null,
        isComment: true,
      };
    })
    .filter((c) => {
      if (!c.author || SKIP.has(c.author.toLowerCase())) return false;
      if (!c.body || c.body.trim() === "[deleted]" || c.body.trim() === "[removed]") return false;
      const stripped = c.body.trim().replace(/https?:\/\/\S+/g, "").trim();
      if (stripped.length < 30) return false;
      if (seenAuthors.has(c.author)) return false;
      if (!c.created || c.created < cutoffSec) return false;
      const text = c.body.toLowerCase();
      if (!HELP_PHRASES.some((ph) => text.includes(ph))) return false;
      seenAuthors.add(c.author);
      return true;
    })
    .sort((a, b) => b.created - a.created)
    .slice(0, 80);

  return NextResponse.json({ comments });
}
