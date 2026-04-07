/**
 * GET /api/monetization — returns content performance reports.
 *
 * Response: { latest: ContentReport | null, history: ContentReport[] }
 */

import { NextResponse } from "next/server";
import { createClientFromRequest } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: reports, error } = await supabase
      .from("content_reports")
      .select("*")
      .eq("user_id", user.id)
      .order("period_start", { ascending: false })
      .limit(8);

    if (error) {
      console.error("[api/monetization] Query failed:", error.message);
      return NextResponse.json({ latest: null, history: [] });
    }

    const history = reports || [];
    const latest = history.length > 0 ? history[0] : null;

    return NextResponse.json({ latest, history: history.reverse() });
  } catch (err) {
    console.error("[api/monetization] Unexpected error:", err);
    return NextResponse.json({ latest: null, history: [] });
  }
}
