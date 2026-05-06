import { createAdminClient } from "@/lib/supabase/server";
import { generateCoachingArc } from "@/lib/coaching-arc";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const secret = request.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Find all users who have 3+ analyzed VODs with a coach report
  const { data: eligible } = await supabase
    .from("vods")
    .select("user_id")
    .eq("status", "ready")
    .not("coach_report", "is", null);

  if (!eligible) return NextResponse.json({ processed: 0 });

  // Count per user, keep only those with 3+
  const counts: Record<string, number> = {};
  for (const row of eligible) {
    counts[row.user_id] = (counts[row.user_id] ?? 0) + 1;
  }
  const userIds = Object.entries(counts)
    .filter(([, n]) => n >= 3)
    .map(([id]) => id);

  const results: { userId: string; status: string }[] = [];

  for (const userId of userIds) {
    try {
      // Use the most recent analyzed VOD ID as the cache key
      const { data: latest } = await supabase
        .from("vods")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "ready")
        .not("coach_report", "is", null)
        .order("stream_date", { ascending: false })
        .limit(1)
        .single();

      if (!latest) {
        results.push({ userId, status: "skipped (no latest vod)" });
        continue;
      }

      const arc = await generateCoachingArc(userId, latest.id, supabase);
      if (arc) {
        await supabase.from("profiles").update({ coaching_arc: arc }).eq("id", userId);
        results.push({ userId, status: `ok (${arc.score_history.length} streams)` });
      } else {
        results.push({ userId, status: "skipped (arc returned null)" });
      }
    } catch (err) {
      results.push({ userId, status: `error: ${err instanceof Error ? err.message : String(err)}` });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
