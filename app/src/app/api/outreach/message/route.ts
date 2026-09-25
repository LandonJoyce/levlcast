import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { angleFor, draftMessage } from "@/lib/outreach";

const ADMIN_EMAIL = "landonjoyce@hotmail.com";

/**
 * Draft a message for a post or comment pasted in by hand.
 *
 * Uses the same drafter as the scheduled queue (lib/outreach.ts). This
 * route used to carry its own, separate prompt, which had drifted: it
 * still pitched "scores 0-100", ended on a bare levlcast.com that Reddit
 * doesn't make clickable, and told the model to pose as a user rather
 * than the person who built it. One prompt means one voice.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postTitle, postBody, authorName, context } = await req.json() as {
    postTitle?: string;
    postBody?: string;
    authorName: string;
    context?: "post" | "comment";
  };
  const isComment = context === "comment";
  if (!isComment && !postTitle) return NextResponse.json({ error: "Missing post data" }, { status: 400 });
  if (isComment && !postBody) return NextResponse.json({ error: "Missing comment body" }, { status: 400 });

  const result = await draftMessage(
    {
      username: authorName,
      source: isComment ? "comment" : "post",
      title: postTitle ?? null,
      body: postBody ?? null,
    },
    angleFor(authorName)
  );

  if (result.kind === "skip") {
    return NextResponse.json({ skip: true, reason: result.reason });
  }
  if (result.kind === "failed") {
    return NextResponse.json({ error: `Couldn't write that one (${result.reason}). Try again.` }, { status: 502 });
  }
  return NextResponse.json({ message: result.body, subject: result.subject });
}
