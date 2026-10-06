import { NextResponse } from "next/server";
import { isDockToken, ownerOfDock, pollLive } from "@/lib/live/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/live/<token>
 *
 * The OBS dock asks this about once a minute. The token is the dock's only
 * key (OBS can't sign in), and it unlocks this one streamer's live numbers
 * and nothing else. See lib/live/server.ts.
 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isDockToken(token)) return NextResponse.json({ error: "Unknown dock link." }, { status: 404 });

  const owner = await ownerOfDock(token);
  if (!owner) {
    return NextResponse.json(
      { error: "This dock link doesn't work anymore. Get your current one from LevlCast, under Live." },
      { status: 404 }
    );
  }

  try {
    // ?panel=1: the OBS panel (it makes the nudges). A phone in voice mode leaves it off.
    const panel = new URL(req.url).searchParams.get("panel") === "1";
    const state = await pollLive(owner, { panel });
    return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[live] poll failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Couldn't reach Twitch just now. Trying again shortly." }, { status: 503 });
  }
}
