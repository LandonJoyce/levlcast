import { NextResponse } from "next/server";
import { speakLine } from "@/lib/deepgram";
import { isDockToken, ownerOfDock, spendSpokenChars } from "@/lib/live/server";
import { isLevlVoice } from "@/lib/live/voices";

export const dynamic = "force-dynamic";

/**
 * One nudge read out in a natural voice, for voice mode on Pro.
 * GET ?v=<voice>&t=<the line>. Only while live, within the stream's
 * budget (lib/live/server.ts), so it can't be used as a free voice service.
 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const owner = isDockToken(token) ? await ownerOfDock(token) : null;
  if (!owner) return NextResponse.json({ error: "Unknown dock link." }, { status: 404 });

  const q = new URL(req.url).searchParams;
  const voice = q.get("v") ?? "";
  const text = (q.get("t") ?? "").trim();
  if (!isLevlVoice(voice) || !text || text.length > 300) return NextResponse.json({ error: "Bad line." }, { status: 400 });
  if (!(await spendSpokenChars(owner, text.length))) return NextResponse.json({ error: "Not available." }, { status: 403 });

  try {
    const audio = await speakLine(text, voice);
    return new NextResponse(audio, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=3600" } });
  } catch (err) {
    console.error("[live] say failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Couldn't read that out." }, { status: 503 });
  }
}
