import { createAdminClient, createClientFromRequest } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cancelChallenge } from "@/lib/duels";

/** DELETE /api/duels/[code]: withdraw your open challenge link. */
export async function DELETE(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await cancelChallenge(createAdminClient(), code, user.id);
  return NextResponse.json({ ok: true });
}
