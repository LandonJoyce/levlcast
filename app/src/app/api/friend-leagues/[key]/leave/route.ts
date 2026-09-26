import { createAdminClient, createClientFromRequest } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { leaveFriendLeague } from "@/lib/friend-leagues";

/** POST /api/friend-leagues/[id]/leave: leave a friend league. */
export async function POST(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await leaveFriendLeague(createAdminClient(), key, user.id);
  return NextResponse.json({ ok: true });
}
