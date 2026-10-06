import { NextResponse } from "next/server";
import { speakLine } from "@/lib/deepgram";
import { isLevlVoice, SAMPLE_LINES, type SampleLine } from "@/lib/live/voices";

/**
 * A natural voice saying one of a few fixed lines, so anyone can hear it
 * before picking it. GET ?v=<voice>&line=sample|on. Only those two
 * parameters are allowed: that keeps it to a handful of different URLs,
 * each read once and then served from the CDN's cache.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const voice = q.get("v") ?? "";
  const line = (q.get("line") ?? "sample") as SampleLine;
  const extra = [...q.keys()].some((k) => k !== "v" && k !== "line");
  if (extra || !isLevlVoice(voice) || !(line in SAMPLE_LINES)) return NextResponse.json({ error: "Bad sample." }, { status: 400 });

  try {
    const audio = await speakLine(SAMPLE_LINES[line], voice);
    return new NextResponse(audio, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=86400, s-maxage=31536000, immutable" },
    });
  } catch (err) {
    console.error("[live] voice sample failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Couldn't play that voice." }, { status: 503 });
  }
}
