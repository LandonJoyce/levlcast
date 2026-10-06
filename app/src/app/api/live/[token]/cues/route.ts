import { NextResponse } from "next/server";
import { cuesSince, isDockToken, ownerOfDock, saveCues } from "@/lib/live/server";

export const dynamic = "force-dynamic";

/**
 * The nudges passed between the OBS panel and a phone in voice mode.
 *
 * POST: the panel sends the nudges it just showed.
 * GET ?after=<ISO time>: the phone asks for anything newer, every few
 * seconds, and speaks it. Also says when the panel last checked in, so the
 * phone knows whether to work out nudges itself.
 */
async function owner(params: Promise<{ token: string }>) {
  const { token } = await params;
  return isDockToken(token) ? ownerOfDock(token) : null;
}

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const o = await owner(params);
  if (!o) return NextResponse.json({ error: "Unknown dock link." }, { status: 404 });
  const after = new URL(req.url).searchParams.get("after");
  try {
    return NextResponse.json(await cuesSince(o, after), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[live] cues read failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Couldn't get your nudges just now." }, { status: 503 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const o = await owner(params);
  if (!o) return NextResponse.json({ error: "Unknown dock link." }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { cues?: unknown };
  if (!Array.isArray(body.cues)) return NextResponse.json({ error: "No nudges sent." }, { status: 400 });
  try {
    const saved = await saveCues(o, body.cues as Array<Record<string, unknown>>);
    return NextResponse.json({ saved });
  } catch (err) {
    console.error("[live] cues save failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Couldn't save the nudges." }, { status: 503 });
  }
}
