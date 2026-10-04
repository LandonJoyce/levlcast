import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cannedReply, fetchThread, namesFromLines, redditPostId, startReview } from "@/lib/review-thread";

const ADMIN_EMAIL = "landonjoyce@hotmail.com";

/** A batch is a handful of names, so one request stays well inside the limit. */
export const maxDuration = 60;
const MAX_NAMES = 10;

async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email === ADMIN_EMAIL;
}

/**
 * GET /api/outreach/reviews?input=<thread link or names>
 *
 * Who asked for a review: the top-level replies to a Reddit thread, or
 * names pasted one per line. Reads only, starts nothing.
 */
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const input = (req.nextUrl.searchParams.get("input") ?? "").trim();
  if (!input) return NextResponse.json({ error: "Paste a thread link or some Twitch names." }, { status: 400 });

  const postId = redditPostId(input);
  if (!postId) {
    if (/reddit\.com\/r\/[^/]+\/s\//i.test(input)) {
      return NextResponse.json(
        { error: "That's a share link. Open the thread and copy the link from the address bar, the one with /comments/ in it." },
        { status: 400 }
      );
    }
    const entries = namesFromLines(input);
    if (entries.length === 0) return NextResponse.json({ error: "No Twitch names in that." }, { status: 400 });
    return NextResponse.json({ entries });
  }

  try {
    const entries = await fetchThread(postId);
    return NextResponse.json({ entries, postId });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't read that thread." }, { status: 502 });
  }
}

/**
 * POST /api/outreach/reviews  { logins: string[] }
 *
 * Start the free report on each one's latest stream. Up to MAX_NAMES per
 * call; the page sends a long thread in batches.
 */
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { logins } = (await req.json().catch(() => ({}))) as { logins?: unknown };
  if (!Array.isArray(logins) || logins.length === 0) {
    return NextResponse.json({ error: "No names to run." }, { status: 400 });
  }
  const names = [...new Set(logins.map((l) => String(l).trim().toLowerCase()).filter((l) => /^[a-z0-9_]{3,25}$/.test(l)))].slice(
    0,
    MAX_NAMES
  );

  const results = await Promise.all(
    names.map(async (login) => {
      const r = await startReview(login);
      return { login, ...r, canned: cannedReply(r.state, login) };
    })
  );
  return NextResponse.json({ results });
}
