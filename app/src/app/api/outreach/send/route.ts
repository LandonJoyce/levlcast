/**
 * Send one outreach message, server side.
 *
 * This is what makes the dashboard button a real single click. The older
 * path opened a prefilled Reddit compose tab, which meant a popup blocker
 * prompt, a login check and a second click inside Reddit for every lead.
 * Reddit's own /api/compose does the whole thing in one request, so the
 * button can go straight from "Send" to "Sent" without a tab ever opening.
 *
 * Sending needs a user-context token, which means all four Reddit
 * variables: CLIENT_ID and CLIENT_SECRET to mint the token, USERNAME and
 * PASSWORD to make it a user token rather than an app-only one. When they
 * are missing this returns a 501 naming exactly what to add, because a
 * generic failure here looks identical to a rate limit and sends you
 * hunting in the wrong place.
 *
 * The queue row is only marked sent after Reddit confirms. A send that
 * fails leaves the row queued so it can be retried, and never records a
 * contact that did not happen.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/server";
import { redditSendMessage } from "@/lib/reddit";

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

/** Every variable the send path needs, reported together rather than one at a time. */
function missingCredentials(): string[] {
  return (["REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET", "REDDIT_USERNAME", "REDDIT_PASSWORD"] as const)
    .filter((name) => !process.env[name]);
}

/**
 * Whether a message can be posted server-side right now.
 *
 * The dashboard asks once on load and picks its Send behaviour from the
 * answer, so adding the credentials later upgrades the buttons with no
 * code change, and their absence never produces a dead button.
 */
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const missing = missingCredentials();
  return NextResponse.json({ configured: missing.length === 0, missing });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: {
    to?: string;
    subject?: string;
    body?: string;
    /** Queue row to mark sent. Absent for a lead messaged straight from the list. */
    queueId?: string;
    /** Recorded alongside a new contact row so dedup and reporting stay accurate. */
    subreddit?: string;
    permalink?: string;
    postTitle?: string;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const to = payload.to?.trim();
  const subject = payload.subject?.trim();
  const body = payload.body?.trim();

  if (!to || !subject || !body) {
    return NextResponse.json({ error: "Need a recipient, a subject and a message" }, { status: 400 });
  }

  const missing = missingCredentials();
  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: `Reddit sending is not configured. Add ${missing.join(", ")} in Vercel and redeploy.`,
        needsSetup: true,
      },
      { status: 501 }
    );
  }

  try {
    await redditSendMessage(to, subject, body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reddit refused the message";
    // Reddit answers a rate limit with a 429 and its own wording. Passing
    // the text straight through beats a house error string, because the
    // body usually says how many minutes are left.
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const admin = createAdminClient();
  const username = to.replace(/^\/?u\//i, "").toLowerCase();

  if (payload.queueId) {
    await admin
      .from("outreach_contacts")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", payload.queueId)
      // Only claim a row still queued, so a double click cannot rewrite a
      // send timestamp that already stands.
      .eq("status", "queued");
  } else {
    // A lead messaged straight from the live list has no row yet. Upsert
    // so the permanent dedup index is honoured rather than violated: if
    // this person is somehow already recorded, the send still succeeded
    // and the existing row is what matters.
    await admin.from("outreach_contacts").upsert(
      {
        reddit_username: username,
        source: "post",
        subreddit: payload.subreddit ?? "",
        permalink: payload.permalink ?? "",
        post_title: payload.postTitle ?? "",
        message_subject: subject,
        message_body: body,
        status: "sent",
        sent_at: new Date().toISOString(),
      },
      { onConflict: "reddit_username" }
    );
  }

  return NextResponse.json({ ok: true, sent: username });
}
