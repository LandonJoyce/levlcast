import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyOptOutLink } from "@/lib/email-optout";

/**
 * POST /api/email/unsubscribe?u=<user id>&t=<signed token>
 *
 * Turns off emails about their streams (migration 037). Two ways in: a
 * mail app's own Unsubscribe button, which POSTs straight here (RFC 8058
 * one-click, from the List-Unsubscribe headers), and the button on
 * /unsubscribe, which adds from=page and gets sent back to that page.
 * There's no GET: mail scanners open links, and opening one shouldn't
 * unsubscribe anybody.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("u") ?? "";
  const token = url.searchParams.get("t") ?? "";
  const fromPage = url.searchParams.get("from") === "page";
  const back = (q: string) => NextResponse.redirect(new URL(`/unsubscribe?${q}`, url.origin), 303);

  if (!userId || !token || !verifyOptOutLink(userId, token)) {
    return fromPage ? back("error=link") : NextResponse.json({ error: "This link doesn't work." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ email_opt_out: true }).eq("id", userId);
  if (error) {
    console.error("[email/unsubscribe] save failed:", error.message);
    return fromPage ? back("error=save") : NextResponse.json({ error: "Could not save that." }, { status: 500 });
  }
  return fromPage ? back("done=1") : NextResponse.json({ ok: true });
}
