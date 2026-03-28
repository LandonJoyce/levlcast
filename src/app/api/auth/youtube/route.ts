import { createClient } from "@/lib/supabase/server";
import { getYouTubeAuthUrl } from "@/lib/youtube";
import { redirect } from "next/navigation";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const state = Buffer.from(user.id).toString("base64");
  const authUrl = getYouTubeAuthUrl(state);
  redirect(authUrl);
}
