import { createClient, createAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FeedbackInbox } from "./FeedbackInbox";

const ADMIN_EMAIL = "landonjoyce@hotmail.com";

export const dynamic = "force-dynamic";

export default async function FeedbackInboxPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) redirect("/dashboard");

  const admin = createAdminClient();
  const { data } = await admin
    .from("feedback")
    .select("id, user_id, email, category, message, context, read, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  return <FeedbackInbox initialFeedback={data ?? []} />;
}
