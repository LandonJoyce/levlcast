/**
 * POST /api/feedback
 *
 * User-submitted feedback. Insert into `feedback` table (RLS enforces
 * user_id = auth.uid()) and notify the admin via email.
 *
 * Hardening:
 *   - Auth required (cookie OR Bearer for mobile).
 *   - Rate limit: 3 per 15 minutes AND 10 per 24 hours per user.
 *   - Message length 4-2000 chars after trim. NUL bytes stripped.
 *   - Category whitelist enforced both here and via CHECK constraint.
 *   - Context is JSON, but we only ever render escaped text in the admin UI
 *     and admin email, never as HTML.
 *   - RLS prevents the user from reading anyone's feedback (including their
 *     own). Only the admin via service role can read.
 */

import { NextResponse } from "next/server";
import { createClientFromRequest, createAdminClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { sendFeedbackToAdmin } from "@/lib/email";

const VALID_CATEGORIES = ["failure", "general", "feature_request", "bug"] as const;
type Category = (typeof VALID_CATEGORIES)[number];

const MAX_MESSAGE_LEN = 2000;
const MIN_MESSAGE_LEN = 4;

export async function POST(request: Request) {
  const supabase = await createClientFromRequest(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!rateLimit(`feedback-short:${user.id}`, 3, 15 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many feedback submissions. Try again in a few minutes." },
      { status: 429 }
    );
  }
  if (!rateLimit(`feedback-day:${user.id}`, 10, 24 * 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Daily feedback limit reached. Try again tomorrow." },
      { status: 429 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const rawMessage = typeof body.message === "string" ? body.message : "";
  const message = rawMessage.replace(/\x00/g, "").replace(/\r\n/g, "\n").trim();

  if (message.length < MIN_MESSAGE_LEN) {
    return NextResponse.json({ error: "Message is too short." }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LEN) {
    return NextResponse.json({ error: "Message is too long (max 2000 characters)." }, { status: 400 });
  }

  const rawCategory = typeof body.category === "string" ? body.category : "general";
  const category: Category = (VALID_CATEGORIES as readonly string[]).includes(rawCategory)
    ? (rawCategory as Category)
    : "general";

  let context: Record<string, unknown> | null = null;
  if (body.context && typeof body.context === "object" && !Array.isArray(body.context)) {
    try {
      const serialized = JSON.stringify(body.context);
      if (serialized.length <= 4000) {
        context = JSON.parse(serialized) as Record<string, unknown>;
      }
    } catch {
      context = null;
    }
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("twitch_login")
    .eq("id", user.id)
    .single();

  const { data: inserted, error } = await admin
    .from("feedback")
    .insert({
      user_id: user.id,
      email: user.email ?? null,
      category,
      message,
      context,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("[feedback] insert failed:", error);
    return NextResponse.json({ error: "Could not save your feedback." }, { status: 500 });
  }

  try {
    await sendFeedbackToAdmin({
      category,
      message,
      fromEmail: user.email ?? null,
      twitchLogin: (profile?.twitch_login as string | null) ?? null,
      userId: user.id,
      context,
    });
  } catch (err) {
    console.error("[feedback] admin email send failed:", err);
  }

  return NextResponse.json({ ok: true });
}
