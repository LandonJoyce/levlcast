import { createAdminClient, createClientFromRequest } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { acceptChallenge } from "@/lib/duels";

/** POST /api/duels/[code]/accept: take the challenge behind a link. */
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await acceptChallenge(createAdminClient(), code, user.id);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
