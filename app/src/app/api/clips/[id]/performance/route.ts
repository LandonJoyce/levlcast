import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const views = body.views_count !== undefined ? Number(body.views_count) : undefined;
  const follows = body.follows_gained !== undefined ? Number(body.follows_gained) : undefined;
  const note = typeof body.performance_note === "string" ? body.performance_note.slice(0, 200) : undefined;

  if (views !== undefined && (!Number.isInteger(views) || views < 0)) {
    return NextResponse.json({ error: "Invalid views_count" }, { status: 400 });
  }
  if (follows !== undefined && (!Number.isInteger(follows) || follows < 0)) {
    return NextResponse.json({ error: "Invalid follows_gained" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: clip } = await admin.from("clips").select("id, user_id").eq("id", id).eq("user_id", user.id).single();
  if (!clip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const update: Record<string, unknown> = {};
  if (views !== undefined) update.views_count = views;
  if (follows !== undefined) update.follows_gained = follows;
  if (note !== undefined) update.performance_note = note;

  await admin.from("clips").update(update).eq("id", id);
  return NextResponse.json({ ok: true });
}
