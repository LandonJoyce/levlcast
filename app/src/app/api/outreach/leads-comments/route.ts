import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const runtime = "edge";

const ADMIN_EMAIL = "landonjoyce@hotmail.com";
const SKIP = new Set(["automoderator", "[deleted]", "reddit"]);

// Subreddits to scope when no subreddit specified
const STREAMING_SUBS = [
  "TwitchStreamers",
  "Twitch_Startup",
  "NewTwitchStreamers",
  "StreamersCommunity",
  "Twitch",
].join("+");

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

  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q")?.trim() || "any tips streaming";
  const subreddit = searchParams.get("subreddit")?.trim() || STREAMING_SUBS;

  const url = new URL("https://arctic-shift.photon-reddit.com/api/comments/search");
  url.searchParams.set("q", q);
  url.searchParams.set("subreddit", subreddit);
  url.searchParams.set("limit", "100");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "LevlCast/1.0", Accept: "application/json" },
  });

  if (!res.ok) {
    return NextResponse.json({ error: `Arctic Shift ${res.status}`, comments: [] });
  }

  const data = await res.json();
  const children: any[] = data.data ?? [];
  const seenAuthors = new Set<string>();

  const comments = children
    .map((c: any) => {
      const postId = typeof c.link_id === "string"
        ? c.link_id.replace(/^t3_/, "")
        : c.link_id ?? "";
      const sub = (c.subreddit as string) ?? "";
      return {
        id: c.id as string,
        title: null as string | null, // comments have no title
        body: ((c.body ?? "") as string).slice(0, 600),
        author: c.author as string,
        subreddit: sub,
        url: `https://www.reddit.com/r/${sub}/comments/${postId}/_/${c.id}/`,
        created: typeof c.created_utc === "string"
          ? parseInt(c.created_utc, 10)
          : (c.created_utc as number) ?? 0,
        flair: null as string | null,
        isComment: true,
      };
    })
    .filter((c) => {
      if (!c.author || SKIP.has(c.author.toLowerCase())) return false;
      if (!c.body || c.body.trim() === "[deleted]") return false;
      if (seenAuthors.has(c.author)) return false;
      seenAuthors.add(c.author);
      return true;
    });

  return NextResponse.json({ comments });
}
