import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = createAdminClient();

  // Verify clip belongs to user
  const { data: clip } = await admin.from("clips").select("id, video_url").eq("id", id).eq("user_id", user.id).single();
  if (!clip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Delete social posts
  await admin.from("social_posts").delete().eq("clip_id", id);

  // Delete clip record
  await admin.from("clips").delete().eq("id", id);

  return NextResponse.json({ success: true });
}
