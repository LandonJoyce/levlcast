/**
 * GET /api/digest — returns the user's latest weekly digest + history.
 *
 * Response: { latest: WeeklyDigest | null, history: WeeklyDigest[] }
 */

import { NextResponse } from "next/server";
import { createClientFromRequest } from "@/lib/supabase/server";
import { getUserUsage } from "@/lib/limits";

export async function GET(request: Request) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const usage = await getUserUsage(user.id);
    if (usage.plan === "free") {
      return NextResponse.json({ locked: true, latest: null, history: [] });
    }

    const { data: digests, error } = await supabase
      .from("weekly_digests")
      .select("*")
      .eq("user_id", user.id)
      .order("week_start", { ascending: false })
      .limit(8);

    if (error) {
      console.error("[api/digest] Query failed:", error.message);
      return NextResponse.json({ latest: null, history: [] });
    }

    const history = digests || [];
    const latest = history.length > 0 ? history[0] : null;

    return NextResponse.json({ latest, history: history.reverse() });
  } catch (err) {
    console.error("[api/digest] Unexpected error:", err);
    return NextResponse.json({ latest: null, history: [] });
  }
}
