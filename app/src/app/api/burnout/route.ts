/**
 * GET /api/burnout — returns the user's burnout history.
 *
 * Response: { latest: BurnoutSnapshot | null, history: BurnoutSnapshot[] }
 * History is the last 8 weeks for the trend chart.
 */

import { NextResponse } from "next/server";
import { createClientFromRequest } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClientFromRequest(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: snapshots } = await supabase
    .from("burnout_snapshots")
    .select("*")
    .eq("user_id", user.id)
    .order("computed_at", { ascending: false })
    .limit(8);

  const history = snapshots || [];
  const latest = history.length > 0 ? history[0] : null;

  return NextResponse.json({ latest, history: history.reverse() });
}
