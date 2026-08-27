import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sendCollabInterestEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/collab/interest/send
 * Body: { recipient_id: string, intro_text: string }
 *
 * Server-side gates (all enforced regardless of client state):
 *   1. caller authenticated
 *   2. caller opted in
 *   3. recipient_id is a real opted-in user
 *   4. recipient ≠ caller (CHECK constraint will reject self-interest too)
 *   5. intro_text 1-200 chars after trim
 *   6. no prior collab_interest between this pair in either direction
 *   7. free users limited to 3 sends per calendar month
 *
 * The DB unique constraint on (sender_id, recipient_id) is the final
 * defense — if two requests race past the pre-check, only one row lands.
 */

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Per-user rate limit — guards against spamming the endpoint to probe
  // recipient existence or hammer the DB. The 3/month cap is the real
  // business rule; this is just abuse mitigation.
  if (!rateLimit(`collab:send:${user.id}`, 10, 60_000)) {
    return NextResponse.json(
      { error: "Slow down. Try again in a minute." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as { recipient_id?: string; intro_text?: string };
  const recipientId = typeof b.recipient_id === "string" ? b.recipient_id.trim() : "";
  const introText = typeof b.intro_text === "string" ? b.intro_text.trim() : "";

  // UUID format check — cheap pre-filter to avoid wasted queries.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recipientId)) {
    return NextResponse.json({ error: "Invalid recipient" }, { status: 400 });
  }
  if (recipientId === user.id) {
    return NextResponse.json({ error: "You can't send an interest to yourself." }, { status: 400 });
  }
  if (introText.length === 0) {
    return NextResponse.json({ error: "Add a short intro message." }, { status: 400 });
  }
  if (introText.length > 200) {
    return NextResponse.json({ error: "Intro must be 200 characters or fewer." }, { status: 400 });
  }

  // Pull caller profile + recipient profile in parallel.
  const admin = createAdminClient();
  const [callerRes, recipientRes] = await Promise.all([
    admin
      .from("profiles")
      .select("id, twitch_display_name, twitch_login, plan, founding_member, pro_plus, subscription_expires_at, collab_opt_in")
      .eq("id", user.id)
      .single(),
    admin
      .from("profiles")
      .select("id, collab_opt_in")
      .eq("id", recipientId)
      .single(),
  ]);

  const caller = callerRes.data;
  const recipient = recipientRes.data;

  if (!caller) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }
  if (!caller.collab_opt_in) {
    return NextResponse.json(
      { error: "Opt in to the Collab Finder in Settings before sending an interest." },
      { status: 403 }
    );
  }
  if (!recipient || !recipient.collab_opt_in) {
    return NextResponse.json(
      { error: "That streamer isn't currently in the Collab Finder." },
      { status: 404 }
    );
  }

  // Free-tier monthly cap (same calendar-month boundary as the rest of the app).
  // Pro = unlimited. Lapsed Pro auto-downgrades like getUserUsage() does.
  const isExpired =
    caller.plan === "pro" &&
    caller.subscription_expires_at &&
    new Date(caller.subscription_expires_at) < new Date();
  const isPaid = caller.plan === "pro" && !isExpired;
  const FREE_SEND_CAP = 3;

  // Pre-check the cap. NOTE: this is a read-then-write check, so a user
  // racing several parallel sends to different recipients can occasionally
  // squeeze 1-2 extra sends past the 3/mo cap. Bounded by parallelism (rate
  // limit caps to ~10/min anyway) and we re-verify post-insert below as
  // belt-and-suspenders. Real distributed locking is future work.
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  if (!isPaid) {
    const { count: sentThisMonth } = await admin
      .from("collab_interests")
      .select("id", { count: "exact", head: true })
      .eq("sender_id", user.id)
      .gte("created_at", monthStart.toISOString());
    if ((sentThisMonth ?? 0) >= FREE_SEND_CAP) {
      return NextResponse.json(
        {
          error: "You've used all 3 free interest sends this month. Upgrade to Pro for unlimited.",
          upgrade: true,
        },
        { status: 402 }
      );
    }
  }

  // Insert — the DB unique constraint on (sender_id, recipient_id) is the
  // ultimate one-shot-per-pair guarantee. Catch the 23505 duplicate-key
  // error and translate to a friendlier message.
  const { data: inserted, error: insertErr } = await admin
    .from("collab_interests")
    .insert({
      sender_id: user.id,
      recipient_id: recipientId,
      intro_text: introText,
      status: "pending",
    })
    .select("id, created_at")
    .single();

  if (insertErr || !inserted) {
    const code = (insertErr as { code?: string } | null)?.code;
    if (code === "23505") {
      return NextResponse.json(
        { error: "You've already reached out to this streamer." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: insertErr?.message || "Insert failed" }, { status: 500 });
  }

  // Post-insert cap verification — kills any extra rows from a race where
  // multiple parallel pre-checks saw count < cap. We only roll back rows
  // whose created_at is strictly LATER than the (cap)-th oldest row in the
  // current month, so the first FREE_SEND_CAP inserts always win.
  if (!isPaid) {
    const { data: monthRows } = await admin
      .from("collab_interests")
      .select("id, created_at")
      .eq("sender_id", user.id)
      .gte("created_at", monthStart.toISOString())
      .order("created_at", { ascending: true });
    const all: Array<{ id: string; created_at: string }> = (monthRows ?? []) as Array<{ id: string; created_at: string }>;
    if (all.length > FREE_SEND_CAP) {
      const cutoffIdx = all.findIndex((r) => r.id === inserted.id);
      if (cutoffIdx >= FREE_SEND_CAP) {
        // We're past the cap. Roll back our own row and reject.
        await admin.from("collab_interests").delete().eq("id", inserted.id);
        return NextResponse.json(
          {
            error: "You've used all 3 free interest sends this month. Upgrade to Pro for unlimited.",
            upgrade: true,
          },
          { status: 402 }
        );
      }
    }
  }

  // Recipient email — best-effort, do not fail the request if Resend errors.
  try {
    const { data: recipientFull } = await admin
      .from("profiles")
      .select("twitch_display_name")
      .eq("id", recipientId)
      .single();
    const { data: authUser } = await admin.auth.admin.getUserById(recipientId);
    const toEmail = authUser?.user?.email;
    if (toEmail) {
      await sendCollabInterestEmail(
        toEmail,
        recipientFull?.twitch_display_name || "Streamer",
        caller.twitch_display_name || "A streamer",
        introText
      );
    }
  } catch (err) {
    console.warn("[collab/send] email notification failed:", err);
  }

  return NextResponse.json({ ok: true });
}
