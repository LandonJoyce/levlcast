/**
 * GET /api/digest — returns the user's latest weekly digest + history.
 *
 * Response: { latest: WeeklyDigest | null, history: WeeklyDigest[] }
 */

import { NextResponse } from "next/server";
import { createClientFromRequest } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClientFromRequest(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: digests } = await supabase
    .from("weekly_digests")
    .select("*")
    .eq("user_id", user.id)
    .order("week_start", { ascending: false })
    .limit(8);

  const history = digests || [];
  const latest = history.length > 0 ? history[0] : null;

  return NextResponse.json({ latest, history: history.reverse() });
}
