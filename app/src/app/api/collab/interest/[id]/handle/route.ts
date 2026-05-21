import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/collab/interest/[id]/handle
 *
 * Returns the OTHER party's Discord handle for an accepted collab interest.
 * Auth required, and the caller must be either the sender or recipient on
 * the interest row, AND the interest must be in 'accepted' status.
 *
 * This is the only authenticated path that surfaces another user's
 * discord_handle. Profiles RLS prevents direct selection from the profiles
 * table by other users, and this route enforces the accept-required gate
 * server-side.
 */

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  // Read via user-scoped client so RLS confirms caller is sender or recipient.
  const { data: interest, error: readErr } = await supabase
    .from("collab_interests")
    .select("id, sender_id, recipient_id, status")
    .eq("id", id)
    .single();

  if (readErr || !interest) {
    return NextResponse.json({ error: "Interest not found" }, { status: 404 });
  }
  if (interest.status !== "accepted") {
    return NextResponse.json(
      { error: "Discord is only revealed after the other side accepts." },
      { status: 403 }
    );
  }
  if (interest.sender_id !== user.id && interest.recipient_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const otherId = interest.sender_id === user.id ? interest.recipient_id : interest.sender_id;
  const admin = createAdminClient();
  const { data: otherProfile } = await admin
    .from("profiles")
    .select("discord_handle")
    .eq("id", otherId)
    .single();

  return NextResponse.json({ discord_handle: (otherProfile?.discord_handle as string | null) ?? null });
}
