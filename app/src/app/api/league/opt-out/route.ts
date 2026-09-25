export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { currentWeekStart } from "@/lib/limits";

/**
 * Leave or rejoin weekly leagues.
 *
 * Leaving takes effect now, not next Monday: the streamer is removed from
 * this week's table immediately, because "take me out" should not mean
 * "you'll be shown to eight people for another four days". Rejoining puts
 * them back on their next analysed stream.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { optOut?: unknown } | null;
  if (typeof body?.optOut !== "boolean") {
    return NextResponse.json({ error: "optOut must be true or false" }, { status: 400 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ league_opt_out: body.optOut })
    .eq("id", user.id);
  if (error) {
    console.error("[league/opt-out] update failed:", error.message);
    return NextResponse.json({ error: "Could not save that. Try again." }, { status: 500 });
  }

  if (body.optOut) {
    // League tables are server-only, so the seat is removed with the
    // admin client. Settled weeks stay: they are history, not a listing.
    const admin = createAdminClient();
    const { error: leaveError } = await admin
      .from("league_members")
      .delete()
      .eq("user_id", user.id)
      .eq("week_start", currentWeekStart())
      .is("final_position", null);
    if (leaveError) console.error("[league/opt-out] leave failed:", leaveError.message);
  }

  return NextResponse.json({ ok: true, optOut: body.optOut });
}
