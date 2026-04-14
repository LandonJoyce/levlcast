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

      <div className="flex items-start justify-between mb-8">
        <div>
          <span className="inline-flex items-center bg-white/[0.04] border border-white/[0.08] text-muted/70 text-[11px] font-medium px-3 py-1 rounded-full mb-3 block w-fit">Your streams</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-1">VODs</h1>
          <p className="text-sm text-muted">Sync your Twitch streams and find the best moments.</p>
          <p className="text-xs text-muted/50 mt-1">After a stream ends, wait a few minutes before syncing.</p>
        </div>
        <SyncButton />
      </div>

      {vodList.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-16 text-center">
          <Film size={28} className="text-muted mx-auto mb-4" />
          <h2 className="text-lg font-bold mb-2">No VODs yet</h2>
          <p className="text-sm text-muted max-w-sm mx-auto">Click Sync VODs above to pull your recent Twitch streams.</p>
        </div>
      ) : (
        <>
          {/* First-analysis spotlight — shown when no streams have been analyzed yet */}
          {analyzed === 0 && !hasProcessing && (() => {
            const spotlight = vodList.find((v) => v.status === "pending" || v.status === "failed");
            if (!spotlight) return null;
            return (
              <div className="rounded-2xl border border-accent/25 bg-accent/[0.04] p-5 mb-5">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-[10px] font-semibold text-accent-light mb-1.5">Start Here</span>
                <h2 className="text-base font-bold text-white mb-1">Analyze your most recent stream</h2>
                <p className="text-sm text-muted mb-4">
                  LevlCast will score your performance, find your peak moments, and give you a full coaching report — takes about 5 minutes.
                </p>
                <div className="flex items-center gap-4 bg-white/[0.03] border border-white/8 rounded-xl p-3">
                  {spotlight.thumbnail_url && (
                    <img src={spotlight.thumbnail_url} alt="" className="w-20 aspect-video rounded object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{spotlight.title}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {formatDuration(spotlight.duration_seconds)} · {new Date(spotlight.stream_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <AnalyzeButton
                    vodId={spotlight.id}
                    status={spotlight.status}
                    vodTitle={spotlight.title}
                    durationSeconds={spotlight.duration_seconds}
                    hasProcessing={false}
                  />
                </div>
              </div>
            );
          })()}

          {/* Stats row */}
          <div className="flex items-center gap-6 mb-5 text-sm">
            <span><span className="font-bold text-white">{vodList.length}</span> <span className="text-muted">total</span></span>
            <span><span className="font-bold text-green-400">{analyzed}</span> <span className="text-muted">analyzed</span></span>
            {pending > 0 && <span><span className="font-bold text-yellow-400">{pending}</span> <span className="text-muted">pending</span></span>}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-surface border border-border rounded-2xl overflow-hidden">
            <div className="grid grid-cols-[48px_2fr_120px_80px_80px_160px] gap-4 px-4 py-2.5 border-b border-border text-[11px] font-medium text-muted">
              <div /><div>Stream</div><div>Date</div><div>Duration</div><div>Score</div><div />
            </div>
            <div className="divide-y divide-border">
              {vodList.map((vod) => {
                const score = (vod.coach_report as any)?.overall_score as number | undefined;
                const scoreColor = score === undefined ? "" : score >= 75 ? "text-green-400" : score >= 50 ? "text-yellow-400" : "text-red-400";
                return (
                  <div key={vod.id} className="grid grid-cols-[48px_2fr_120px_80px_80px_160px] gap-4 px-4 py-3 items-center hover:bg-white/[0.02] transition-colors">
                    <div className="w-12 aspect-video rounded overflow-hidden bg-bg flex-shrink-0">
                      {vod.thumbnail_url ? <img src={vod.thumbnail_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Film size={12} className="text-muted" /></div>}
                    </div>
                    <div className="min-w-0"><p className="text-sm font-medium text-white truncate">{vod.title}</p></div>
                    <div className="text-xs text-muted">{new Date(vod.stream_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                    <div className="text-xs text-muted">{formatDuration(vod.duration_seconds)}</div>
                    <div>{score !== undefined ? <span className={`text-sm font-bold ${scoreColor}`}>{score}</span> : <span className="text-xs text-muted/40">—</span>}</div>
                    <div className="flex items-center justify-end">
                      {vod.status === "transcribing" || vod.status === "analyzing" ? (
                        <VodProgress status={vod.status} durationSeconds={vod.duration_seconds} compact />
                      ) : vod.status === "ready" ? (
                        <Link href={`/dashboard/vods/${vod.id}`} className="inline-flex items-center gap-1.5 bg-accent hover:opacity-85 text-white text-xs font-semibold px-3.5 py-1.5 rounded-full transition-all duration-300 hover:-translate-y-px">
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

          {/* Mobile card list */}
          <div className="md:hidden bg-surface border border-border rounded-2xl divide-y divide-border overflow-hidden">
            {vodList.map((vod) => {
              const score = (vod.coach_report as any)?.overall_score as number | undefined;
              const scoreColor = score === undefined ? "text-muted" : score >= 75 ? "text-green-400" : score >= 50 ? "text-yellow-400" : "text-red-400";
              return (
                <div key={vod.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-14 aspect-video rounded overflow-hidden bg-bg flex-shrink-0">
                    {vod.thumbnail_url ? <img src={vod.thumbnail_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Film size={11} className="text-muted" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{vod.title}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {new Date(vod.stream_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {formatDuration(vod.duration_seconds)}
                      {score !== undefined && <span className={` · font-bold ${scoreColor}`}> {score}</span>}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    {vod.status === "transcribing" || vod.status === "analyzing" ? (
                      <VodProgress status={vod.status} durationSeconds={vod.duration_seconds} compact />
                    ) : vod.status === "ready" ? (
                      <Link href={`/dashboard/vods/${vod.id}`} className="inline-flex items-center gap-1 bg-accent hover:opacity-85 text-white text-xs font-semibold px-3 py-1.5 rounded-full transition-opacity">
                        Report <ChevronRight size={10} />
                      </Link>
                    ) : (
                      <AnalyzeButton vodId={vod.id} status={vod.status} vodTitle={vod.title} durationSeconds={vod.duration_seconds} hasProcessing={hasProcessing} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
