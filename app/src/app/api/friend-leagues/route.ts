import { createAdminClient, createClientFromRequest } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { createFriendLeague } from "@/lib/friend-leagues";

/**
 * POST /api/friend-leagues   { name }
 *
 * Start a friend league. Returns { code, url }: the invite link to share.
 */
export async function POST(request: Request) {
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(`friend-league-create:${user.id}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many tries. Give it a minute." }, { status: 429 });
  }
  const body = await request.json().catch(() => ({}));
  const result = await createFriendLeague(createAdminClient(), user.id, String(body?.name ?? ""));
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  const origin = new URL(request.url).origin;
  return NextResponse.json({ code: result.code, url: `${origin}/join/${result.code}` });
}
