/**
 * POST /api/tts
 *
 * Converts coach report text to speech using OpenAI TTS (onyx voice).
 * Returns audio/mpeg stream. Requires OPENAI_API_KEY env var.
 *
 * Body: { text: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "TTS not configured" }, { status: 501 });
  }

  const { text } = await req.json();
  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }

  // OpenAI TTS has a 4096 character limit
  const truncated = text.slice(0, 4096);

  const ttsRes = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      input: truncated,
      voice: "onyx",
      response_format: "mp3",
      speed: 0.95,
    }),
  });

  if (!ttsRes.ok) {
    const err = await ttsRes.text();
    console.error("[TTS] OpenAI error:", err);
    return NextResponse.json({ error: "TTS generation failed" }, { status: 502 });
  }

  const audioBuffer = await ttsRes.arrayBuffer();

  return new NextResponse(audioBuffer, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
