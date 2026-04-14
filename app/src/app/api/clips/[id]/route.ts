import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = createAdminClient();

  // Verify clip belongs to user
  const { data: clip } = await admin.from("clips").select("id, video_url, status").eq("id", id).eq("user_id", user.id).single();
  if (!clip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Soft-delete: mark as deleted instead of removing the row.
  // This preserves the monthly clip count so deleting and regenerating
  // doesn't let users bypass the limit.
  await admin.from("clips").update({ status: "deleted" }).eq("id", id);

  return NextResponse.json({ success: true });
}
