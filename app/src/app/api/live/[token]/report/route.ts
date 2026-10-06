import { NextResponse } from "next/server";
import { isDockToken, ownerOfDock, streamReport } from "@/lib/live/server";

export const dynamic = "force-dynamic";

/**
 * GET: where the last stream's report is at, for the panel's end of
 * stream screen. Starting the report happens on the dashboard.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const owner = isDockToken(token) ? await ownerOfDock(token) : null;
  if (!owner) return NextResponse.json({ error: "Unknown dock link." }, { status: 404 });
  try {
    return NextResponse.json(await streamReport(owner), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[live] report status failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Couldn't check on your report just now." }, { status: 503 });
  }
}
