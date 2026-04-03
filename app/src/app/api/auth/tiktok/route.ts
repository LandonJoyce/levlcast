import { createClient } from "@/lib/supabase/server";
import { getTikTokAuthUrl } from "@/lib/tiktok";
import { redirect } from "next/navigation";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const nonce = crypto.randomUUID();
  const state = Buffer.from(JSON.stringify({ userId: user.id, nonce })).toString("base64");
  const authUrl = getTikTokAuthUrl(state);
  redirect(authUrl);
}
