import { NextResponse } from "next/server";
import { createClientFromRequest } from "@/lib/supabase/server";
import { getUserUsage } from "@/lib/limits";

/**
 * GET /api/usage
 * Returns the live free-trial or Pro usage for the authenticated user.
 * Mobile reads from this for accurate counters in Settings and the
 * Subscribe paywall, since trial_records lives behind RLS.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const usage = await getUserUsage(user.id, supabase);
    return NextResponse.json(usage);
  } catch (err) {
    console.error("[api/usage] Unexpected error:", err);
    return NextResponse.json({ error: "Failed to load usage" }, { status: 500 });
  }
}
