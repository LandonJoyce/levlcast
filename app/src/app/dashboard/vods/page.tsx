import { createClient } from "@/lib/supabase/server";
import { SyncButton } from "@/components/dashboard/sync-button";
import { AnalyzeButton } from "@/components/dashboard/analyze-button";
import { VodStatusPoller } from "@/components/dashboard/vod-status-poller";
import { formatDuration } from "@/lib/utils";
import { Film, Clock, Calendar, ChevronRight } from "lucide-react";
import { VodProgress } from "@/components/dashboard/vod-progress";
import Link from "next/link";

function statusStyle(status: string) {
  switch (status) {
    case "ready": return "bg-green-500/10 text-green-400";
    case "transcribing":
    case "analyzing": return "bg-yellow-500/10 text-yellow-400";
    case "failed": return "bg-red-500/10 text-red-400";
    default: return "bg-white/5 text-muted";
  }
}

export default async function VodsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: vods } = await supabase
    .from("vods")
    .select("*")
    .eq("user_id", user!.id)
    .order("stream_date", { ascending: false });

  const vodList = vods || [];
  const hasProcessing = vodList.some((v) => v.status === "transcribing" || v.status === "analyzing");
  const analyzed = vodList.filter((v) => v.status === "ready").length;
  const pending = vodList.filter((v) => v.status === "pending").length;

  return (
    <div>
      <VodStatusPoller hasProcessing={hasProcessing} />

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight mb-1">VODs</h1>
          <p className="text-sm text-muted">Sync your Twitch streams and find the best moments.</p>
        </div>
        <SyncButton />
      </div>

      {vodList.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-16 text-center">
          <Film size={28} className="text-muted mx-auto mb-4" />
          <h2 className="text-lg font-bold mb-2">No VODs yet</h2>
          <p className="text-sm text-muted max-w-sm mx-auto">Click Sync VODs to pull your recent Twitch streams.</p>
        </div>
      ) : (
        <>
          {/* Stats row */}
          <div className="flex items-center gap-6 mb-5 text-sm">
            <span><span className="font-bold text-white">{vodList.length}</span> <span className="text-muted">total</span></span>
            <span><span className="font-bold text-green-400">{analyzed}</span> <span className="text-muted">analyzed</span></span>
            {pending > 0 && <span><span className="font-bold text-yellow-400">{pending}</span> <span className="text-muted">pending</span></span>}
          </div>

          {/* Table */}
          <div className="bg-surface border border-border rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[48px_2fr_120px_80px_80px_160px] gap-4 px-4 py-2.5 border-b border-border text-[11px] font-semibold text-muted uppercase tracking-wide">
              <div />
              <div>Stream</div>
              <div>Date</div>
              <div>Duration</div>
              <div>Score</div>
              <div />
            </div>

            {/* Rows */}
            <div className="divide-y divide-border">
              {vodList.map((vod) => {
                const score = (vod.coach_report as any)?.overall_score as number | undefined;
                const scoreColor = score === undefined ? "" : score >= 75 ? "text-green-400" : score >= 50 ? "text-yellow-400" : "text-red-400";

                return (
                  <div
                    key={vod.id}
                    className="grid grid-cols-[48px_2fr_120px_80px_80px_160px] gap-4 px-4 py-3 items-center hover:bg-white/[0.02] transition-colors"
                  >
                    {/* Thumbnail */}
                    <div className="w-12 aspect-video rounded overflow-hidden bg-bg flex-shrink-0">
                      {vod.thumbnail_url ? (
                        <img src={vod.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Film size={12} className="text-muted" />
                        </div>
                      )}
                    </div>

                    {/* Title */}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{vod.title}</p>
                    </div>

                    {/* Date */}
                    <div className="text-xs text-muted">
                      {new Date(vod.stream_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </div>

                    {/* Duration */}
                    <div className="text-xs text-muted">{formatDuration(vod.duration_seconds)}</div>

                    {/* Score */}
                    <div>
                      {score !== undefined ? (
                        <span className={`text-sm font-bold ${scoreColor}`}>{score}</span>
                      ) : (
                        <span className="text-xs text-muted/40">—</span>
                      )}
                    </div>

                    {/* Action */}
                    <div className="flex items-center justify-end">
                      {vod.status === "transcribing" || vod.status === "analyzing" ? (
                        <VodProgress status={vod.status} durationSeconds={vod.duration_seconds} compact />
                      ) : vod.status === "ready" ? (
                        <Link
                          href={`/dashboard/vods/${vod.id}`}
                          className="inline-flex items-center gap-1.5 bg-accent hover:opacity-85 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity"
                        >
                          Coach Report <ChevronRight size={11} />
                        </Link>
                      ) : (
                        <AnalyzeButton vodId={vod.id} status={vod.status} vodTitle={vod.title} durationSeconds={vod.duration_seconds} hasProcessing={hasProcessing} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
