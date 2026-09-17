/**
 * Shareable permalink for a public preview.
 *
 * Every preview gets a stable URL keyed by the Twitch VOD id, so a report
 * can be dropped in a Discord or sent to a friend and it renders instantly
 * from cache. Server-rendered so link unfurls carry the real score.
 */

import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { PreviewReport, type PreviewPayload } from "@/components/preview/preview-report";
import { AnalyzeClient } from "../analyze-client";

export const dynamic = "force-dynamic";

async function loadPreview(vodId: string): Promise<PreviewPayload | null> {
  if (!/^\d{6,}$/.test(vodId)) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("public_previews")
    .select("*")
    .eq("twitch_vod_id", vodId)
    .maybeSingle();
  return (data as PreviewPayload | null) ?? null;
}

export async function generateMetadata(
  { params }: { params: Promise<{ vodId: string }> }
): Promise<Metadata> {
  const { vodId } = await params;
  const preview = await loadPreview(vodId);

  if (!preview || preview.status !== "ready") {
    return { title: "Stream Report" };
  }

  const name = preview.streamer_display_name || preview.streamer_login || "This stream";
  const score = preview.coach_report?.overall_score ?? "?";

  return {
    title: `${name} — ${score}/100`,
    description: preview.coach_report?.recommendation ?? "A free coaching report on this Twitch stream.",
    openGraph: {
      title: `${name} scored ${score}/100`,
      description: preview.coach_report?.recommendation ?? "A free coaching report on this Twitch stream.",
      url: `https://www.levlcast.com/analyze/${vodId}`,
    },
  };
}

export default async function PreviewPermalink(
  { params }: { params: Promise<{ vodId: string }> }
) {
  const { vodId } = await params;
  const preview = await loadPreview(vodId);

  if (!preview) notFound();

  // Still running, or it failed. Hand it to the client component, which
  // already knows how to poll, show progress, and offer a retry.
  if (preview.status !== "ready" || !preview.coach_report) {
    return (
      <main style={{ minHeight: "100vh", background: "#0A0C10" }}>
        <Suspense fallback={null}>
          <AnalyzeClient initialPreview={preview} />
        </Suspense>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0A0C10", padding: "48px 20px 80px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <PreviewReport preview={preview} />
      </div>
    </main>
  );
}
