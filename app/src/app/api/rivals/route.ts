import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { twitchLogin } = await req.json();
  if (!twitchLogin || typeof twitchLogin !== "string") {
    return NextResponse.json({ error: "twitchLogin required" }, { status: 400 });
  }

  const login = twitchLogin.toLowerCase().trim();
  if (login.length < 2 || login.length > 50) {
    return NextResponse.json({ error: "Invalid Twitch login" }, { status: 400 });
  }

  // Look up rival's profile by twitch_login
  const admin = createAdminClient();
  const { data: rivalProfile } = await admin
    .from("profiles")
    .select("id, twitch_display_name, twitch_login")
    .eq("twitch_login", login)
    .maybeSingle();

  // Upsert the rival record
  const { error } = await supabase
    .from("rivals")
    .upsert(
      {
        challenger_id: user.id,
        rival_twitch_login: login,
        rival_id: rivalProfile?.id ?? null,
      },
      { onConflict: "challenger_id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    found: !!rivalProfile,
    rival: rivalProfile ?? null,
  });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await supabase.from("rivals").delete().eq("challenger_id", user.id);
  return NextResponse.json({ ok: true });
}
