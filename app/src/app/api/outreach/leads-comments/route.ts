import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const runtime = "edge";

const ADMIN_EMAIL = "landonjoyce@hotmail.com";
const SKIP = new Set(["automoderator", "[deleted]", "reddit"]);

// Same phrases as posts — filter comment bodies for help-seeking language
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

  const subreddit = req.nextUrl.searchParams.get("subreddit") ?? "TwitchStreamers";

  // Arctic Shift comments endpoint — only supports subreddit + limit, no keyword search
  const res = await fetch(
    `https://arctic-shift.photon-reddit.com/api/comments/search?subreddit=${encodeURIComponent(subreddit)}&limit=100`,
    { headers: { "User-Agent": "LevlCast/1.0", Accept: "application/json" } }
  );

  if (!res.ok) {
    return NextResponse.json({ error: `Arctic Shift ${res.status}`, comments: [] });
  }

  const data = await res.json();
  if (data.error) return NextResponse.json({ error: data.error, comments: [] });

  const children: any[] = data.data ?? [];
  const seenAuthors = new Set<string>();

  const comments = children
    .map((c: any) => {
      const postId = typeof c.link_id === "string"
        ? c.link_id.replace(/^t3_/, "")
        : String(c.link_id ?? "");
      const sub = (c.subreddit as string) ?? subreddit;
      return {
        id: c.id as string,
        title: null as string | null,
        body: ((c.body ?? "") as string).slice(0, 600),
        author: c.author as string,
        subreddit: sub,
        url: `https://www.reddit.com/r/${sub}/comments/${postId}/_/${c.id}/`,
        created: typeof c.created_utc === "string"
          ? parseInt(c.created_utc, 10)
          : (c.created_utc as number) ?? (c.created as number) ?? 0,
        flair: null as string | null,
        isComment: true,
      };
    })
    .filter((c) => {
      if (!c.author || SKIP.has(c.author.toLowerCase())) return false;
      if (!c.body || c.body.trim() === "[deleted]") return false;
      // Skip comments that are just a URL or too short to have real context
      const stripped = c.body.trim().replace(/https?:\/\/\S+/g, "").trim();
      if (stripped.length < 30) return false;
      if (seenAuthors.has(c.author)) return false;
      const text = c.body.toLowerCase();
      if (!HELP_PHRASES.some((ph) => text.includes(ph))) return false;
      seenAuthors.add(c.author);
      return true;
    });

  return NextResponse.json({ comments });
}
