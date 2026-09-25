/**
 * Shareable permalink for a public preview.
 *
 * Every preview gets a stable URL keyed by the Twitch VOD id, so a report
 * can be dropped in a Discord or sent to a friend and it renders instantly
 * from cache. Server-rendered so link unfurls carry the real score.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { PreviewReport, type PreviewPayload } from "@/components/preview/preview-report";
import SiteHeader from "@/components/landing/SiteHeader";
import SiteFooter from "@/components/landing/SiteFooter";
import { AnalyzeClient } from "../analyze-client";
import { shoulders } from "../../fonts";
import "../../home-ranked.css";
import "../analyze.css";

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
    title: `${name}: ${score}/100`,
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

  return (
    <div className={`ll-page v3 az ${shoulders.variable}`}>
      <SiteHeader />
      {preview.status !== "ready" || !preview.coach_report ? (
        // Still running, or it failed. Hand it to the client component,
        // which already knows how to poll, show progress, and offer a retry.
        <AnalyzeClient initialPreview={preview} />
      ) : (
        <main className="az-main az-done">
          <PreviewReport preview={preview} />
          {/* Most people opening a shared report are streamers themselves. */}
          <Link href="/analyze" className="v3-btn v3-btn-ghost az-again">
            Try it on your own stream
          </Link>
        </main>
      )}
      <SiteFooter />
    </div>
  );
}
