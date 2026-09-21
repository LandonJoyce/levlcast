/**
 * The outreach queue: drafts the scheduled harvest has already written.
 *
 * GET  — list what is waiting to be sent
 * POST — mark one as sent (or skipped) once it has gone out
 *
 * Reddit's compose endpoint needs credentials we do not have, so the
 * actual delivery happens in a prefilled Reddit tab. This route is what
 * makes that a single click: the message is already written, and marking
 * it sent here keeps the permanent dedup table honest so the same person
 * never resurfaces.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/server";

const ADMIN_EMAIL = "landonjoyce@hotmail.com";

async function requireAdmin(req: NextRequest): Promise<boolean> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return req.cookies.getAll(); }, setAll() {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email === ADMIN_EMAIL;
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("outreach_contacts")
    .select("id, reddit_username, subreddit, permalink, post_title, post_excerpt, message_subject, message_body, angle, created_at")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message, queue: [] }, { status: 500 });
  }

  return NextResponse.json({ queue: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { id?: string; action?: "sent" | "skip" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const status = body.action === "skip" ? "skipped" : "sent";
  const admin = createAdminClient();

  const { error } = await admin
    .from("outreach_contacts")
    .update({
      status,
      ...(status === "sent" ? { sent_at: new Date().toISOString() } : { skip_reason: "skipped by hand" }),
    })
    .eq("id", body.id)
    // Only claim a row that is still queued, so a double click cannot
    // rewrite a send timestamp or resurrect a skipped contact.
    .eq("status", "queued");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status });
}
