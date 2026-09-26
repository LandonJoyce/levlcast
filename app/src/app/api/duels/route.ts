import { createAdminClient, createClientFromRequest } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getOrCreateChallenge } from "@/lib/duels";

/**
 * POST /api/duels
 *
 * Your challenge link: the open one you already have, or a new one.
 * Returns { code, url }. Whoever opens the link and accepts is your
 * opponent for the next seven days.
 */
export async function POST(request: Request) {
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(`duel-create:${user.id}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many tries. Give it a minute." }, { status: 429 });
  }

  const result = await getOrCreateChallenge(createAdminClient(), user.id);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  const origin = new URL(request.url).origin;
  return NextResponse.json({ code: result.code, url: `${origin}/duel/${result.code}` });
}
