import { createClient } from "@/lib/supabase/server";
import { SyncButton } from "@/components/dashboard/sync-button";
import { AnalyzeButton } from "@/components/dashboard/analyze-button";
import { VodStatusPoller } from "@/components/dashboard/vod-status-poller";
import { formatDuration } from "@/lib/utils";
import { Film, Clock, Calendar, ChevronRight } from "lucide-react";
import Link from "next/link";

/** Status badge colors */
function statusStyle(status: string) {
  switch (status) {
    case "ready":
      return "bg-green-500/10 text-green-400";
    case "transcribing":
    case "analyzing":
      return "bg-yellow-500/10 text-yellow-400";
    case "failed":
      return "bg-red-500/10 text-red-400";
    default:
      return "bg-white/5 text-muted";
  }
}

export default async function VodsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: vods } = await supabase
    .from("vods")
    .select("*")
    .eq("user_id", user!.id)
    .order("stream_date", { ascending: false });

  const vodList = vods || [];
  const hasProcessing = vodList.some((v) => v.status === "transcribing" || v.status === "analyzing");

  return (
    <div>
      <VodStatusPoller hasProcessing={hasProcessing} />

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight mb-1">VODs</h1>
          <p className="text-sm text-muted">
            Sync your Twitch streams and find the best moments.
          </p>
        </div>
        <SyncButton />
      </div>

      {vodList.length === 0 ? (
        /* Empty state */
        <div className="bg-surface border border-border rounded-2xl p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-5">
            <Film size={24} className="text-accent-light" />
          </div>
          <h2 className="text-xl font-bold mb-2">No VODs yet</h2>
          <p className="text-sm text-muted max-w-md mx-auto">
            Click Sync VODs to pull your recent Twitch streams.
            LevlCast will then analyze them for peak moments.
          </p>
        </div>
      ) : (
        /* VOD list */
        <div className="space-y-3">
          {vodList.map((vod) => (
            <div
              key={vod.id}
              className="bg-surface border border-border rounded-2xl p-4 flex gap-4 items-start hover:border-white/10 transition-colors"
            >
              {/* Thumbnail */}
              <div className="relative flex-shrink-0 w-40 aspect-video rounded-lg overflow-hidden bg-bg">
                {vod.thumbnail_url ? (
                  <img
                    src={vod.thumbnail_url}
                    alt={vod.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Film size={20} className="text-muted" />
                  </div>
                )}
                {/* Duration overlay */}
                <span className="absolute bottom-1 right-1 bg-black/80 text-white text-xs font-medium px-1.5 py-0.5 rounded">
                  {formatDuration(vod.duration_seconds)}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                {vod.status === "ready" ? (
                  <Link href={`/dashboard/vods/${vod.id}`} className="group flex items-center gap-1 mb-1.5">
                    <h3 className="font-bold text-sm truncate group-hover:text-accent-light transition-colors">{vod.title}</h3>
                    <ChevronRight size={14} className="flex-shrink-0 text-muted group-hover:text-accent-light transition-colors" />
                  </Link>
                ) : (
                  <h3 className="font-bold text-sm truncate mb-1.5">{vod.title}</h3>
                )}
                <div className="flex items-center gap-4 text-xs text-muted mb-2">
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
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full capitalize ${statusStyle(vod.status)}`}
                  >
                    {vod.status}
                  </span>
                  <AnalyzeButton vodId={vod.id} status={vod.status} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
