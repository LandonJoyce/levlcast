/**
 * POST /api/collab/dismiss — dismiss a collab suggestion.
 * Body: { suggestionId: string }
 */

import { NextResponse } from "next/server";
import { createClientFromRequest } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { suggestionId } = body;
    if (!suggestionId) return NextResponse.json({ error: "Missing suggestionId" }, { status: 400 });

    await supabase
      .from("collab_suggestions")
      .update({ status: "dismissed" })
      .eq("id", suggestionId)
      .eq("user_id", user.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/collab/dismiss] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
