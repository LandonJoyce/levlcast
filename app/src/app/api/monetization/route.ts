/**
 * GET /api/monetization — returns content performance reports.
 *
 * Response: { latest: ContentReport | null, history: ContentReport[] }
 * History is the last 8 weeks for the trend view.
 */

import { NextResponse } from "next/server";
import { createClientFromRequest } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClientFromRequest(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: reports } = await supabase
    .from("content_reports")
    .select("*")
    .eq("user_id", user.id)
    .order("period_start", { ascending: false })
    .limit(8);

  const history = reports || [];
  const latest = history.length > 0 ? history[0] : null;

  return NextResponse.json({ latest, history: history.reverse() });
}
