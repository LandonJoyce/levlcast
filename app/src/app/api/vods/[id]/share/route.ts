import { createClientFromRequest, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

/**
 * POST /api/vods/[id]/share
 * Generates a unique share token for the VOD and returns the shareable URL.
 * The token is a random UUID — unguessable and read-only.
 *
 * DELETE /api/vods/[id]/share
 * Revokes the share token so the link no longer works.
 */

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClientFromRequest(request);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify the VOD belongs to this user and is ready
  const { data: vod } = await supabase
    .from("vods")
    .select("id, status, share_token")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!vod) {
    return NextResponse.json({ error: "VOD not found" }, { status: 404 });
  }

  if (vod.status !== "ready") {
    return NextResponse.json({ error: "VOD must be analyzed before sharing" }, { status: 400 });
  }

  // Reuse existing token if already set, otherwise generate a new one
  const token = vod.share_token ?? randomUUID();

  if (!vod.share_token) {
    const admin = createAdminClient();
    await admin.from("vods").update({ share_token: token }).eq("id", id);
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.levlcast.com";
  return NextResponse.json({ url: `${baseUrl}/share/${token}` });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClientFromRequest(request);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("vods")
    .update({ share_token: null })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: "Failed to revoke link" }, { status: 500 });
  }

  return NextResponse.json({ revoked: true });
}
