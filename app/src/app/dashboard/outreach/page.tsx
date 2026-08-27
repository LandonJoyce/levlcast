import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import OutreachClient from "./OutreachClient";

const ADMIN_EMAIL = "landonjoyce@hotmail.com";

export default async function OutreachPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) redirect("/dashboard");
  return <OutreachClient />;
}
