import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const GROWTH_KEYWORDS = [
  "grow", "growth", "viewers", "viewer", "no views", "struggling",
  "advice", "feedback", "help", "small", "starting", "started",
  "how do i", "how to", "tips", "improve", "better", "dead chat",
  "no one watching", "nobody watching", "dead stream", "retention",
];

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subreddit = req.nextUrl.searchParams.get("subreddit") ?? "TwitchStreamers";
  const sort = req.nextUrl.searchParams.get("sort") ?? "new";

  const url = `https://www.reddit.com/r/${subreddit}/${sort}.json?limit=50&raw_json=1`;

  const res = await fetch(url, {
    headers: { "User-Agent": "LevlCastApp/1.0" },
    next: { revalidate: 120 },
  });

  if (!res.ok) return NextResponse.json({ error: "Reddit unavailable" }, { status: 502 });

  const data = await res.json();
  const children = data.data?.children ?? [];

  const posts = children
    .map((c: any) => ({
      id: c.data.id,
      title: c.data.title as string,
      body: (c.data.selftext as string)?.slice(0, 600) ?? "",
      author: c.data.author as string,
      subreddit: c.data.subreddit as string,
      url: `https://reddit.com${c.data.permalink}`,
      score: c.data.score as number,
      created: c.data.created_utc as number,
      flair: c.data.link_flair_text as string | null,
    }))
    .filter((p: any) => {
      if (p.author === "AutoModerator" || p.author === "[deleted]") return false;
      const text = `${p.title} ${p.body}`.toLowerCase();
      return GROWTH_KEYWORDS.some((k) => text.includes(k));
    });

  return NextResponse.json({ posts });
}
