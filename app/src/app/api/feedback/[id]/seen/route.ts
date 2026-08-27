/**
 * POST /api/feedback/[id]/seen
 *
 * Mark an admin reply as seen by the user. Only the row owner can mark
 * their own reply seen — we check user_id = auth.uid() in the WHERE clause
 * so this is a no-op if a user tries to mark someone else's row.
 */

import { NextResponse } from "next/server";
import { createClientFromRequest, createAdminClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClientFromRequest(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("feedback")
    .update({ user_seen_reply: true })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
