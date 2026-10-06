import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { speakLine } from "@/lib/deepgram";
import { isLevlVoice, SAMPLE_LINES, type SampleLine } from "@/lib/live/voices";

/**
 * A natural voice saying one of a few fixed lines, so anyone can hear it
 * before picking it. GET ?v=<voice>&line=sample|on, written exactly that
 * way: any other spelling of the address is refused, so there are only a
 * dozen of them. Each line is read once, kept in the server's cache, and
 * served from the CDN after that, so playing samples costs nothing.
 */
const readSample = unstable_cache(
  async (voice: string, line: SampleLine) => Buffer.from(await speakLine(SAMPLE_LINES[line], voice)).toString("base64"),
  ["live-voice-sample-v1"],
  { revalidate: false }
);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const voice = url.searchParams.get("v") ?? "";
  const line = url.searchParams.get("line") ?? "";
  if (!isLevlVoice(voice) || !Object.hasOwn(SAMPLE_LINES, line) || url.search !== `?v=${voice}&line=${line}`) {
    return NextResponse.json({ error: "Bad sample." }, { status: 400 });
  }

  try {
    const audio = Buffer.from(await readSample(voice, line as SampleLine), "base64");
    return new NextResponse(new Uint8Array(audio), {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=86400, s-maxage=31536000, immutable" },
    });
  } catch (err) {
    console.error("[live] voice sample failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Couldn't play that voice." }, { status: 503 });
  }
}
