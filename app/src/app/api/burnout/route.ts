/**
 * GET /api/burnout — returns the user's burnout history.
 *
 * Response: { latest: BurnoutSnapshot | null, history: BurnoutSnapshot[] }
 * History is the last 8 weeks for the trend chart.
 */

import { NextResponse } from "next/server";
import { createClientFromRequest } from "@/lib/supabase/server";
import { getUserUsage } from "@/lib/limits";

export async function GET(request: Request) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const usage = await getUserUsage(user.id, supabase);
    if (usage.plan === "free") {
      return NextResponse.json({ locked: true, latest: null, history: [] });
    }

    const { data: snapshots, error } = await supabase
      .from("burnout_snapshots")
      .select("*")
      .eq("user_id", user.id)
      .order("computed_at", { ascending: false })
      .limit(8);

    if (error) {
      console.error("[api/burnout] Query failed:", error.message);
      return NextResponse.json({ latest: null, history: [] });
    }

    const history = snapshots || [];
    const latest = history.length > 0 ? history[0] : null;

    return NextResponse.json({ latest, history: history.reverse() });
  } catch (err) {
    console.error("[api/burnout] Unexpected error:", err);
    return NextResponse.json({ latest: null, history: [] });
  }
}
