/**
 * POST /api/collab/dismiss — dismiss a collab suggestion.
 * Body: { suggestionId: string }
 */

import { NextResponse } from "next/server";
import { createClientFromRequest } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClientFromRequest(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { suggestionId } = await request.json();
  if (!suggestionId) return NextResponse.json({ error: "Missing suggestionId" }, { status: 400 });

  await supabase
    .from("collab_suggestions")
    .update({ status: "dismissed" })
    .eq("id", suggestionId)
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
