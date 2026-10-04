import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { draftReviewReply, reportLink, reviewReport } from "@/lib/review-thread";

const ADMIN_EMAIL = "landonjoyce@hotmail.com";

export const maxDuration = 60;

/**
 * POST /api/outreach/reviews/reply  { vodId, author?, comment? }
 *
 * Where one person's report is, and once it's finished, the reply to post
 * under their comment. The page calls this every few seconds until it gets
 * a reply or a failure, so a report that isn't ready costs nothing.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { vodId, author, comment } = (await req.json().catch(() => ({}))) as {
    vodId?: string;
    author?: string | null;
    comment?: string | null;
  };
  if (!vodId || !/^\d{6,}$/.test(vodId)) return NextResponse.json({ error: "Missing stream." }, { status: 400 });

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("public_previews")
    .select("status, title, coach_report, failed_reason, created_at")
    .eq("twitch_vod_id", vodId)
    .maybeSingle();
  if (!row) return NextResponse.json({ status: "failed", reason: "The report was never started. Run it again." });

  const url = reportLink(vodId);
  if (row.status === "failed") {
    return NextResponse.json({ status: "failed", reason: row.failed_reason ?? "The report failed.", url });
  }
  if (row.status !== "ready") {
    // Same cut-off the public analyzer uses for a preview that died.
    const stale = Date.now() - Date.parse(String(row.created_at)) > 15 * 60 * 1000;
    return stale
      ? NextResponse.json({ status: "failed", reason: "The report got stuck. Run it again.", url })
      : NextResponse.json({ status: "pending", url });
  }

  const report = reviewReport(row);
  if (!report) return NextResponse.json({ status: "failed", reason: "The report came back empty.", url });
  try {
    const reply = await draftReviewReply({ report, vodId, author: author ?? null, comment: comment ?? null });
    return NextResponse.json({ status: "ready", reply, url });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ status: "draft_failed", reason: `Couldn't write the reply (${reason}).`, url });
  }
}
