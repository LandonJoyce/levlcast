export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Emails about your streams on or off, from Account (migration 037). The
 * streamer's own row, so their own session writes it.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { optOut?: unknown } | null;
  if (typeof body?.optOut !== "boolean") {
    return NextResponse.json({ error: "optOut must be true or false" }, { status: 400 });
  }

  const { error } = await supabase.from("profiles").update({ email_opt_out: body.optOut }).eq("id", user.id);
  if (error) {
    console.error("[account/emails] update failed:", error.message);
    return NextResponse.json({ error: "Could not save that. Try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, optOut: body.optOut });
}
