import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dockTokenFor, rotateDockToken } from "@/lib/live/server";

export const dynamic = "force-dynamic";

function dockUrl(req: NextRequest, token: string): string {
  return `${req.nextUrl.origin}/live/${token}`;
}

/** GET: the signed-in streamer's dock link, made the first time. */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  try {
    return NextResponse.json({ url: dockUrl(req, await dockTokenFor(user.id)) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't make your dock link." }, { status: 500 });
  }
}

/** POST: a new link, which stops the old one working wherever it was pasted. */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  try {
    return NextResponse.json({ url: dockUrl(req, await rotateDockToken(user.id)) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't make a new link." }, { status: 500 });
  }
}
