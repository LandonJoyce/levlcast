import { NextResponse } from "next/server";
import { clipOfChannel, isClipId, isDockToken, ownerOfDock } from "@/lib/live/server";

export const dynamic = "force-dynamic";

/** Lookups per streamer a minute: clip links in chat come now and then, not in a stream. */
const MAX_PER_MINUTE = 20;
const asked = new Map<string, number[]>();

/**
 * GET /api/live/<token>/clip?id=<clip id>
 *
 * Someone posted a clip link in chat. If it's a clip of this streamer's
 * channel, the panel can say so right away instead of waiting for Twitch
 * to list it. `agoMs` is by the server's clock, so the panel's own clock
 * being off doesn't matter.
 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const owner = isDockToken(token) ? await ownerOfDock(token) : null;
  if (!owner) return NextResponse.json({ error: "Unknown dock link." }, { status: 404 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!isClipId(id)) return NextResponse.json({ error: "That isn't a clip id." }, { status: 400 });

  const now = Date.now();
  const recent = (asked.get(owner.userId) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= MAX_PER_MINUTE) return NextResponse.json({ clip: null }, { status: 429 });
  asked.set(owner.userId, [...recent, now]);

  const clip = await clipOfChannel(owner.twitchId, id);
  return NextResponse.json({ clip, agoMs: clip ? Math.max(0, now - Date.parse(clip.createdAt)) : null }, { headers: { "Cache-Control": "no-store" } });
}
