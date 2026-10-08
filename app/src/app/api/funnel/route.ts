/**
 * POST /api/funnel  { event, ref?, detail? }
 *
 * A visitor's browser reporting one step of the signup funnel. See
 * lib/funnel.ts. Public by necessity (visitors aren't signed in yet), so
 * it only accepts the fixed list of step names, caps every field, and
 * rate-limits by IP. Any failure is swallowed: a lost event must never
 * break the page that sent it.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { CLIENT_EVENTS, REF_COOKIE, REF_PATTERN, VISITOR_COOKIE, type ClientEvent } from "@/lib/funnel";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`funnel:${ip}`, 120, 60 * 60 * 1000)) return new NextResponse(null, { status: 204 });

  let body: { event?: string; ref?: string; detail?: string } = {};
  try {
    body = await request.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const event = body.event as ClientEvent;
  if (!CLIENT_EVENTS.includes(event)) return new NextResponse(null, { status: 204 });

  const visitor = request.cookies.get(VISITOR_COOKIE)?.value ?? "";
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(visitor)) return new NextResponse(null, { status: 204 });

  // The ref on the page wins for the landing itself; after that, the cookie.
  const rawRef = (body.ref ?? request.cookies.get(REF_COOKIE)?.value ?? "").toLowerCase();
  const ref = REF_PATTERN.test(rawRef) ? rawRef : null;
  let detail = typeof body.detail === "string" ? body.detail.slice(0, 200) : null;

  // An app visit belongs to whoever's session this is, not to an id the page sent.
  if (event === "app_open") {
    const { data: { user } } = await (await createClient()).auth.getUser();
    if (!user) return new NextResponse(null, { status: 204 });
    detail = user.id;
  }

  try {
    await createAdminClient().from("funnel_events").insert({ visitor, ref, event, detail });
  } catch {
    // Before migration 033 the table doesn't exist. Nothing to do.
  }
  return new NextResponse(null, { status: 204 });
}
