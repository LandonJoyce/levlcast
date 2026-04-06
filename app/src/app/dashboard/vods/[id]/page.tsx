import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDuration } from "@/lib/utils";
import { CoachReportCard } from "@/components/dashboard/coach-report-card";
import { GenerateClipButton } from "@/components/dashboard/generate-clip-button";
import { ShareReportButton } from "@/components/dashboard/share-report-button";
import { VodProgress } from "@/components/dashboard/vod-progress";
import { VodStatusPoller } from "@/components/dashboard/vod-status-poller";
import { ArrowLeft, Calendar, Clock, Film } from "lucide-react";

export default async function VodDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: vod }, { count: processingClipCount }] = await Promise.all([
    supabase
      .from("vods")
      .select("*, share_token")
      .eq("id", id)
      .eq("user_id", user!.id)
      .single(),
    supabase
      .from("clips")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user!.id)
      .eq("status", "processing"),
  ]);

  if (!vod) notFound();

  const peaks = (vod.peak_data as any[]) || [];
  const coachReport = vod.coach_report as any;

  const isProcessing = vod.status === "transcribing" || vod.status === "analyzing";
  const hasProcessingClip = (processingClipCount ?? 0) > 0;

  return (
    <div>
      <VodStatusPoller hasProcessing={isProcessing} />
      {/* Back + Header */}
      <div className="mb-6">
        <Link
          href="/dashboard/vods"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-white transition-colors mb-4"
        >
          <ArrowLeft size={14} />
          Back to VODs
        </Link>
        <div className="flex gap-4 items-start">
          {vod.thumbnail_url && (
            <div className="relative flex-shrink-0 w-40 aspect-video rounded-xl overflow-hidden bg-bg">
              <img
                src={vod.thumbnail_url}
                alt={vod.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-extrabold tracking-tight mb-2 leading-snug">
              {vod.title}
            </h1>
            <div className="flex items-center gap-4 text-xs text-muted">
              <span className="inline-flex items-center gap-1">
                <Calendar size={12} />
                {new Date(vod.stream_date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock size={12} />
                {formatDuration(vod.duration_seconds)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {vod.status !== "ready" ? (
        <div>
          {vod.status === "transcribing" || vod.status === "analyzing" ? (
            <VodProgress
              status={vod.status}
              durationSeconds={vod.duration_seconds}
            />
          ) : (
            <div className="bg-surface border border-border rounded-2xl p-10 text-center">
              <Film size={24} className="text-muted mx-auto mb-3" />
              <p className="text-sm text-muted">
                {vod.status === "pending"
                  ? "This VOD hasn't been analyzed yet. Go back and click Analyze."
                  : `Analysis failed${vod.failed_reason ? `: ${vod.failed_reason}` : ""}. Go back and try analyzing again.`}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Share button */}
          <div className="flex justify-end">
            <ShareReportButton vodId={vod.id} existingToken={vod.share_token} />
          </div>

          {/* Coach Report */}
          {coachReport ? (
            <CoachReportCard report={coachReport} />
          ) : (
            <div className="bg-surface border border-border rounded-2xl p-6 text-sm text-muted">
              Coach report not available for this VOD. Re-analyze to generate one.
            </div>
          )}

          {/* Peak Moments */}
          {peaks.length > 0 && (
            <div>
              <h2 className="text-base font-bold mb-3">
                Peak Moments ({peaks.length})
              </h2>
              <div className="space-y-3">
                {peaks.map((peak: any, i: number) => (
                  <div
                    key={i}
                    className="bg-surface border border-border rounded-2xl p-4"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="font-semibold text-sm">{peak.title}</h3>
                      <span className="flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent-light capitalize">
                        {peak.category}
                      </span>
                    </div>
                    <p className="text-xs text-muted mb-3">{peak.reason}</p>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 text-xs text-muted">
                        <span>
                          {formatDuration(peak.start)} –{" "}
                          {formatDuration(peak.end)}
                        </span>
                        <span className="text-accent-light font-medium">
                          Score {Math.round(peak.score * 100)}
                        </span>
                      </div>
                      <GenerateClipButton vodId={vod.id} peakIndex={i} hasProcessing={hasProcessingClip} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
