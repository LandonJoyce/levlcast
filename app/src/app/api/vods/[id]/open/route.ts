import { createAdminClient, createClientFromRequest } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isLocked, isPlacementResult, isSealed, lockOpensAt } from "@/lib/sealed";

/**
 * POST /api/vods/[id]/open   { call?: "win" | "loss" }
 *
 * Opens a sealed result. The call, if any, is stored with it so match
 * history can say "Called it". Returns what the report says so the page
 * can play the reveal before it reloads.
 *
 * Opening an already-open result just returns it again, so a double
 * click or a retry never changes the call. A locked extra stream (a free
 * streamer's third of the week) is refused until the week is over or
 * they go Pro.
 *
 * Writes go through the admin client: the browser can't touch these
 * columns (see migration 032).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const call = body?.call === "win" || body?.call === "loss" ? (body.call as "win" | "loss") : null;

  const admin = createAdminClient();
  const [{ data: vod }, { data: profile }] = await Promise.all([
    admin
      .from("vods")
      .select("id, status, rank_delta, rank_points_after, result_opened_at, result_call, sealed_extra_week")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    admin.from("profiles").select("plan, subscription_expires_at").eq("id", user.id).maybeSingle(),
  ]);
  if (!vod || vod.status !== "ready") return NextResponse.json({ error: "not_found" }, { status: 404 });

  const reply = (openedCall: string | null) =>
    NextResponse.json({
      opened: true,
      call: openedCall,
      delta: vod.rank_delta,
      pointsAfter: vod.rank_points_after,
      placement: isPlacementResult(vod),
    });

  if (!isSealed(vod)) return reply(vod.result_call ?? null);

  const isPro =
    profile?.plan === "pro" &&
    !(profile.subscription_expires_at && new Date(profile.subscription_expires_at) < new Date());
  if (isLocked(vod, isPro)) {
    return NextResponse.json(
      { error: "locked", opensAt: lockOpensAt(vod.sealed_extra_week as string) },
      { status: 403 }
    );
  }

  const storedCall = isPlacementResult(vod) ? null : call;
  // Only the first open writes. A second request that races this one
  // matches nothing and falls through to the same reply.
  await admin
    .from("vods")
    .update({ result_opened_at: new Date().toISOString(), result_call: storedCall })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("result_opened_at", null);

  const { data: after } = await admin.from("vods").select("result_call").eq("id", id).maybeSingle();
  return reply((after?.result_call as string | null) ?? storedCall);
}
