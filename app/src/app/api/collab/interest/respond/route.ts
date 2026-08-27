import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sendCollabAcceptedEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/collab/interest/respond
 * Body: { interest_id: string, action: "accept" | "pass" }
 *
 * The caller MUST be the recipient of the interest and the row MUST still
 * be pending. On accept, we email the original sender with the recipient's
 * Discord handle. On pass, nothing happens (silent rejection by design).
 *
 * Discord reveal is only on accept: the sender will see the recipient's
 * Discord handle inline in the accept email and in their "sent" view.
 */

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!rateLimit(`collab:respond:${user.id}`, 30, 60_000)) {
    return NextResponse.json({ error: "Slow down. Try again shortly." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as { interest_id?: string; action?: string };
  const interestId = typeof b.interest_id === "string" ? b.interest_id.trim() : "";
  const action = b.action === "accept" ? "accept" : b.action === "pass" ? "pass" : null;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(interestId)) {
    return NextResponse.json({ error: "Invalid interest id" }, { status: 400 });
  }
  if (!action) {
    return NextResponse.json({ error: "Action must be 'accept' or 'pass'" }, { status: 400 });
  }

  // Pull the interest row to confirm caller is the recipient AND status is still pending.
  // We use the user-scoped client so RLS enforces recipient access.
  const { data: interest, error: readErr } = await supabase
    .from("collab_interests")
    .select("id, sender_id, recipient_id, status, intro_text")
    .eq("id", interestId)
    .single();

  if (readErr || !interest) {
    return NextResponse.json({ error: "Interest not found" }, { status: 404 });
  }
  if (interest.recipient_id !== user.id) {
    return NextResponse.json({ error: "Not your interest to respond to" }, { status: 403 });
  }
  if (interest.status !== "pending") {
    return NextResponse.json({ error: "Already responded to this interest." }, { status: 409 });
  }

  const nextStatus = action === "accept" ? "accepted" : "passed";
  // Conditional update — only flip if still pending. Prevents double-accept
  // / double-pass races. .maybeSingle() because zero rows is a valid race
  // outcome (a parallel response already won), not an error.
  const { data: updated, error: updateErr } = await supabase
    .from("collab_interests")
    .update({ status: nextStatus, responded_at: new Date().toISOString() })
    .eq("id", interestId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (updateErr) {
    return NextResponse.json({ error: "Could not update interest" }, { status: 500 });
  }
  if (!updated) {
    // Status flipped between our read and write — someone (probably the same
    // user in another tab) already responded. Treat as conflict, not failure.
    return NextResponse.json({ error: "Already responded to this interest." }, { status: 409 });
  }

  if (action === "accept") {
    // Email the sender with the recipient's Discord handle.
    // Best-effort — don't fail the request if email errors.
    try {
      const admin = createAdminClient();
      const [recipientRes, senderEmailRes] = await Promise.all([
        admin
          .from("profiles")
          .select("twitch_display_name, discord_handle")
          .eq("id", user.id)
          .single(),
        admin.auth.admin.getUserById(interest.sender_id),
      ]);

      const recipientName = (recipientRes.data?.twitch_display_name as string | null) || "Streamer";
      const discordHandle = (recipientRes.data?.discord_handle as string | null) || null;
      const senderEmail = senderEmailRes.data?.user?.email;

      if (senderEmail && discordHandle) {
        // Pull sender's display name for friendly greeting
        const { data: senderProfile } = await admin
          .from("profiles")
          .select("twitch_display_name")
          .eq("id", interest.sender_id)
          .single();
        await sendCollabAcceptedEmail(
          senderEmail,
          (senderProfile?.twitch_display_name as string | null) || "Streamer",
          recipientName,
          discordHandle
        );
      }
    } catch (err) {
      console.warn("[collab/respond] accept email failed:", err);
    }
  }
  // No notification on pass — silent rejection by design.

  return NextResponse.json({ ok: true });
}
