import { sendActivationEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// One-shot: emails all users who never analyzed a VOD. DELETE after use.
export async function GET() {
  const supabase = createAdminClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, twitch_display_name");

  if (!profiles) return NextResponse.json({ sent: 0 });

  const results: string[] = [];

  for (const profile of profiles) {
    const { count } = await supabase
      .from("vods")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("status", "ready");

    if ((count ?? 0) > 0) continue;

    const { data: { user } } = await supabase.auth.admin.getUserById(profile.id);
    if (!user?.email) continue;

    // Skip the owner account
    if (user.email === "orbitxd@live.com") continue;

    await sendActivationEmail(user.email, profile.twitch_display_name || "Streamer");
    results.push(user.email);
  }

  return NextResponse.json({ sent: results.length, emails: results });
}
