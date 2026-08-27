/**
 * POST /api/admin/feedback/[id]/reply
 *
 * Admin-only. Save a reply to the feedback row and email the original
 * submitter. Setting admin_reply also resets user_seen_reply to false so
 * the dashboard surface flips back to unread when the admin edits a reply.
 */

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sendFeedbackReplyToUser } from "@/lib/email";

const ADMIN_EMAIL = "landonjoyce@hotmail.com";
const MAX_REPLY_LEN = 4000;
const MIN_REPLY_LEN = 2;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const rawReply = typeof body.reply === "string" ? body.reply : "";
  const reply = rawReply.replace(/\x00/g, "").replace(/\r\n/g, "\n").trim();

  if (reply.length < MIN_REPLY_LEN) {
    return NextResponse.json({ error: "Reply too short." }, { status: 400 });
  }
  if (reply.length > MAX_REPLY_LEN) {
    return NextResponse.json({ error: "Reply too long (max 4000)." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: feedback, error: fetchError } = await admin
    .from("feedback")
    .select("id, user_id, email, message")
    .eq("id", id)
    .single();

  if (fetchError || !feedback) {
    return NextResponse.json({ error: "Feedback not found" }, { status: 404 });
  }

  const { error: updateError } = await admin
    .from("feedback")
    .update({
      admin_reply: reply,
      admin_reply_at: new Date().toISOString(),
      user_seen_reply: false,
      read: true,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (feedback.email) {
    let name = "there";
    if (feedback.user_id) {
      const { data: profile } = await admin
        .from("profiles")
        .select("twitch_display_name")
        .eq("id", feedback.user_id)
        .single();
      if (profile?.twitch_display_name) name = profile.twitch_display_name as string;
    }
    try {
      await sendFeedbackReplyToUser({
        to: feedback.email as string,
        name,
        originalMessage: feedback.message as string,
        reply,
      });
    } catch (err) {
      console.error("[feedback-reply] email send failed:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
