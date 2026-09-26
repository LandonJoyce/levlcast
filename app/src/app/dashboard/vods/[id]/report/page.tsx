import { redirect } from "next/navigation";

/**
 * The full report used to be its own page under the stream. It's part of
 * the stream page now, so old links (emails, bookmarks, shared tabs) land
 * there instead.
 */
export default async function VodReportRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/dashboard/vods/${id}`);
}
