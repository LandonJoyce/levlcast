import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { REVIEW_SUBS, REVIEW_TITLES } from "@/lib/review-subs";

const ADMIN_EMAIL = "landonjoyce@hotmail.com";

type Post = {
  id?: string;
  subreddit?: string;
  title?: string;
  permalink?: string;
  created_utc?: number;
  num_comments?: number;
  removed_by_category?: string | null;
  _meta?: { removal_type?: string };
};

/**
 * GET /api/outreach/reviews/mine
 *
 * Review threads posted from the outreach account in the last 30 days,
 * read from the Arctic Shift mirror (it has new posts within minutes), so
 * a thread posted from the dashboard is tracked without pasting its link.
 * A thread counts when it's in one of the review subs and carries one of
 * the review titles, or asks for a Twitch name.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const author = process.env.REDDIT_USERNAME || "BMWDouche";
  const after = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const url = `https://arctic-shift.photon-reddit.com/api/posts/search?author=${encodeURIComponent(author)}&after=${after}&limit=100`;
  let rows: Post[];
  try {
    const res = await fetch(url, { headers: { "User-Agent": "LevlCast/1.0", Accept: "application/json" }, cache: "no-store" });
    if (!res.ok) throw new Error(`The Reddit mirror said ${res.status}.`);
    rows = ((await res.json())?.data ?? []) as Post[];
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't reach the Reddit mirror." }, { status: 502 });
  }

  const subs = new Map(REVIEW_SUBS.map((s) => [s.name.toLowerCase(), s.name]));
  const threads = rows
    .filter((p) => p.id && subs.has(String(p.subreddit ?? "").toLowerCase()))
    .filter((p) => {
      const title = String(p.title ?? "").toLowerCase();
      return REVIEW_TITLES.has(title) || title.includes("twitch name");
    })
    .map((p) => ({
      id: String(p.id),
      sub: subs.get(String(p.subreddit).toLowerCase())!,
      title: String(p.title ?? ""),
      url: `https://www.reddit.com${p.permalink ?? `/comments/${p.id}/`}`,
      created: Number(p.created_utc ?? 0),
      comments: Number(p.num_comments ?? 0),
      removed: !!(p.removed_by_category || p._meta?.removal_type),
    }))
    .sort((a, b) => b.created - a.created);

  return NextResponse.json({ threads });
}
