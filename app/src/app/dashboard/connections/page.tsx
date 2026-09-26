import { redirect } from "next/navigation";

/**
 * Connections live on the Account page now. The YouTube and TikTok sign-in
 * callbacks still come back here, so their result is passed along.
 */
export default async function ConnectionsRedirect({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const params = await searchParams;
  const q = new URLSearchParams();
  if (params.success) q.set("success", params.success);
  if (params.error) q.set("error", params.error);
  const qs = q.toString();
  redirect(`/dashboard/settings${qs ? `?${qs}` : ""}#connections`);
}
