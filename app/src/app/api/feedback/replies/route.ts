/**
 * GET /api/feedback/replies
 *
 * Returns the calling user's own feedback rows that have an admin reply.
 * We use the admin client + filter by auth.uid() server-side, so the user
 * only ever sees their own data and only the fields we choose to expose.
 *
 * No SELECT RLS policy on `feedback` — this server-side filter is the
 * only path users have to read their feedback. That's intentional: it
 * lets us control field exposure without column-level RLS.
 */

import { NextResponse } from "next/server";
import { createClientFromRequest, createAdminClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClientFromRequest(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("feedback")
    .select("id, category, message, admin_reply, admin_reply_at, user_seen_reply, created_at")
    .eq("user_id", user.id)
    .not("admin_reply", "is", null)
    .order("admin_reply_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ replies: data ?? [] });
}
