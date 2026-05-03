import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { vod_id?: string; checked?: number[] };
  const { vod_id, checked } = body;
  if (typeof vod_id !== "string" || !Array.isArray(checked)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ mission_checks: { vod_id, checked } })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
