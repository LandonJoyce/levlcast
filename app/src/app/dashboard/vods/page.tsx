import { createClient } from "@/lib/supabase/server";
import { SyncButton } from "@/components/dashboard/sync-button";
import { AnalyzeButton } from "@/components/dashboard/analyze-button";
import { VodStatusPoller } from "@/components/dashboard/vod-status-poller";
import { formatDuration } from "@/lib/utils";
import { Film, ChevronRight, Sparkles } from "lucide-react";
import { VodProgress } from "@/components/dashboard/vod-progress";
import Link from "next/link";

function scoreHex(n: number) { return n >= 75 ? "#4ade80" : n >= 50 ? "#facc15" : "#f87171"; }
function scoreCls(n: number) { return n >= 75 ? "text-green-400" : n >= 50 ? "text-yellow-400" : "text-red-400"; }

function statusAccent(status: string) {
  switch (status) {
    case "ready": return "#4ade80";
    case "transcribing":
    case "analyzing": return "#facc15";
    case "failed": return "#f87171";
    default: return "rgba(255,255,255,0.08)";
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
  const processing = vodList.filter((v) => v.status === "transcribing" || v.status === "analyzing").length;

  return (
    <div>
      <VodStatusPoller hasProcessing={hasProcessing} />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div>
          <span className="inline-flex items-center bg-white/[0.04] border border-white/[0.08] text-muted/70 text-[11px] font-medium px-3 py-1 rounded-full mb-3 block w-fit">Your streams</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-1">VODs</h1>
          <p className="text-sm text-muted">Sync your Twitch streams and find the best moments.</p>
          <p className="text-xs text-muted/50 mt-1">After a stream ends, wait a few minutes before syncing.</p>
        </div>
        <SyncButton />
      </div>

      {vodList.length === 0 ? (
        <div
          className="rounded-2xl p-16 text-center relative overflow-hidden"
          style={{
            background: "radial-gradient(ellipse 70% 60% at 50% 0%, rgba(139,92,246,0.12) 0%, rgba(10,9,20,0) 70%), rgba(10,9,20,0.98)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.6), transparent)" }} />
          <Film size={28} className="text-violet-400/60 mx-auto mb-4" />
          <h2 className="text-xl font-black mb-2 tracking-tight">No VODs yet</h2>
          <p className="text-sm text-white/55 max-w-sm mx-auto leading-relaxed">Click Sync VODs above to pull your recent Twitch streams.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Start Here spotlight */}
          {analyzed === 0 && !hasProcessing && (() => {
            const spotlight = vodList.find((v) => v.status === "pending" || v.status === "failed");
            if (!spotlight) return null;
            return (
              <div
                className="rounded-2xl relative overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, rgba(139,92,246,0.14) 0%, rgba(109,40,217,0.05) 60%, rgba(10,9,20,0) 100%)",
                  border: "1px solid rgba(139,92,246,0.28)",
                  boxShadow: "0 0 30px rgba(139,92,246,0.08) inset",
                }}
              >
                <div className="absolute top-0 left-0 w-40 h-px" style={{ background: "linear-gradient(90deg, rgba(139,92,246,0.7), transparent)" }} />

                <div className="px-6 py-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={12} className="text-violet-400" />
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-violet-400">Start Here</span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-black text-white mb-1 tracking-tight">Analyze your most recent stream</h2>
                  <p className="text-sm text-white/55 mb-5 leading-relaxed">
                    LevlCast will score your performance, find your peak moments, and give you a full coaching report — takes about 5 minutes.
                  </p>

                  <div
                    className="flex items-center gap-4 rounded-xl p-3.5"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    {spotlight.thumbnail_url ? (
                      <img src={spotlight.thumbnail_url} alt="" className="w-24 aspect-video rounded-lg object-cover flex-shrink-0" style={{ border: "1px solid rgba(139,92,246,0.25)" }} />
                    ) : (
                      <div className="w-24 aspect-video rounded-lg flex-shrink-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(139,92,246,0.25)" }}>
                        <Film size={16} className="text-violet-400/50" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{spotlight.title}</p>
                      <p className="text-xs text-white/45 mt-0.5">
                        {formatDuration(spotlight.duration_seconds)} · {new Date(spotlight.stream_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
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
              </div>
            );
          })()}

          {/* Status strip */}
          <div className="grid grid-cols-3 gap-3">
            <StatTile label="Total streams" value={vodList.length} color="#8b5cf6" />
            <StatTile label="Analyzed" value={analyzed} color="#4ade80" />
            <StatTile label={processing > 0 ? "Processing" : "Pending"} value={processing > 0 ? processing : pending} color="#facc15" />
          </div>

          {/* VOD list */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "rgba(10,9,20,0.98)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div className="px-6 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-violet-400 mb-0.5">Stream Library</p>
              <h2 className="text-sm font-bold text-white">Every VOD we've pulled from Twitch</h2>
            </div>

            <div className="divide-y divide-white/[0.04]">
              {vodList.map((vod) => {
                const score = (vod.coach_report as any)?.overall_score as number | undefined;
                const accent = statusAccent(vod.status);
                const isReady = vod.status === "ready";
                const isProcessing = vod.status === "transcribing" || vod.status === "analyzing";
                const isFailed = vod.status === "failed";
                const peaks = ((vod.peak_data as any[]) || []).length;

                return (
                  <div key={vod.id} className="flex items-stretch group hover:bg-white/[0.02] transition-colors">
                    {/* Status accent bar */}
                    <div className="w-[3px] flex-shrink-0" style={{ background: accent, opacity: 0.8 }} />

                    <div className="flex items-center gap-4 px-5 py-4 flex-1 min-w-0">
                      {/* Thumbnail */}
                      <div className="w-20 sm:w-24 aspect-video rounded-lg overflow-hidden flex-shrink-0 relative" style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        {vod.thumbnail_url ? (
                          <img src={vod.thumbnail_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Film size={14} className="text-white/25" />
                          </div>
                        )}
                        {isReady && score !== undefined && (
                          <span
                            className="absolute bottom-1 left-1 text-[10px] font-black tabular-nums px-1.5 py-0.5 rounded"
                            style={{ background: "rgba(0,0,0,0.75)", color: scoreHex(score), border: `1px solid ${scoreHex(score)}60` }}
                          >
                            {score}
                          </span>
                        )}
                      </div>

                      {/* Title + meta */}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm sm:text-base font-bold text-white truncate group-hover:text-white transition-colors">{vod.title}</p>
                        <p className="text-xs text-white/45 mt-1">
                          {new Date(vod.stream_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          {" · "}{formatDuration(vod.duration_seconds)}
                          {isReady && peaks > 0 && <> {" · "}<span className="text-white/60 font-semibold">{peaks}</span> moment{peaks !== 1 ? "s" : ""}</>}
                        </p>
                      </div>

                      {/* Score / status bar (desktop) */}
                      {isReady && score !== undefined && (
                        <div className="hidden lg:flex items-center gap-2 flex-shrink-0 w-28">
                          <div className="flex-1 h-1 rounded-full bg-white/[0.05] overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${score}%`, background: scoreHex(score), boxShadow: `0 0 6px ${scoreHex(score)}55` }} />
                          </div>
                          <span className={`text-lg font-black tabular-nums leading-none ${scoreCls(score)}`}>{score}</span>
                        </div>
                      )}

                      {/* Action */}
                      <div className="flex items-center flex-shrink-0">
                        {isProcessing ? (
                          <VodProgress status={vod.status} durationSeconds={vod.duration_seconds} compact />
                        ) : isReady ? (
                          <Link href={`/dashboard/vods/${vod.id}`} className="inline-flex items-center gap-1.5 bg-accent hover:opacity-85 text-white text-xs font-bold px-3.5 py-2 rounded-full transition-all duration-300 hover:-translate-y-px">
                            <span className="hidden sm:inline">Coach Report</span>
                            <span className="sm:hidden">Report</span>
                            <ChevronRight size={11} />
                          </Link>
                        ) : isFailed ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-extrabold uppercase tracking-widest text-red-400">Failed</span>
                            <AnalyzeButton vodId={vod.id} status={vod.status} vodTitle={vod.title} durationSeconds={vod.duration_seconds} hasProcessing={hasProcessing} />
                          </div>
                        ) : (
                          <AnalyzeButton vodId={vod.id} status={vod.status} vodTitle={vod.title} durationSeconds={vod.duration_seconds} hasProcessing={hasProcessing} />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="rounded-2xl px-5 py-4 relative overflow-hidden"
      style={{ background: "rgba(10,9,20,0.98)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="absolute top-0 left-0 w-16 h-px" style={{ background: `linear-gradient(90deg, ${color}80, transparent)` }} />
      <p className="text-3xl sm:text-4xl font-black tabular-nums leading-none mb-1.5" style={{ color }}>{value}</p>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/45">{label}</p>
    </div>
  );
}
