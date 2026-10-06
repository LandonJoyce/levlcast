import { NextResponse } from "next/server";
import { isDockToken, listenOnce, ownerOfDock } from "@/lib/live/server";

export const dynamic = "force-dynamic";
// Pulling the audio, transcribing it and asking the coach can take a few seconds.
export const maxDuration = 60;

/**
 * The listening coach (Pro). An open dock calls this about every half
 * minute with its last few minutes of chat and what OBS shows; the server
 * hears the stream since the last call and sometimes answers with a tip.
 * Always answers 200 with when to call next, so a hiccup never stops the dock.
 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const owner = isDockToken(token) ? await ownerOfDock(token) : null;
  if (!owner) return NextResponse.json({ error: "Unknown dock link." }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    return NextResponse.json(await listenOnce(owner, body), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[live] listen failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ state: "error", nextMs: 30_000 });
  }
}
