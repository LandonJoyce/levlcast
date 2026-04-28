import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { GenerateClipButton } from "@/components/dashboard/generate-clip-button";
import { PostToYouTube, DownloadClip } from "@/components/dashboard/clip-actions";
import { ExportClipButton } from "@/components/dashboard/clip-export-modal";
import { FailedClipCard } from "@/components/dashboard/failed-clip-card";
import { VodStatusPoller } from "@/components/dashboard/vod-status-poller";
import { ClipPerformanceLogger } from "@/components/dashboard/clip-performance-logger";
import { scoreColorVar } from "@/lib/score-utils";
import { getUserUsage } from "@/lib/limits";

interface Peak {
  title: string;
  start: number;
  end: number;
  score: number;
  category: string;
  reason: string;
  caption: string;
}

function formatTimestamp(seconds: number | null): string {
  if (!seconds) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

function categoryLabel(c: string): string {
  if (c === "funny") return "COMEDY";
  return c.toUpperCase();
}

function categoryChipClass(c: string): string {
  switch (c) {
    case "hype":        return "m"; // magenta
    case "funny":       return "w"; // warn (yellow)
    case "emotional":   return "r"; // danger (red)
    case "educational": return "b"; // blue
    default:            return "";
  }
}

const Icons = {
  Plus: () => (
    <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  Play: () => (
    <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
      <path d="M7 5l12 7-12 7V5z" fill="currentColor"/>
    </svg>
  ),
  YT: () => (
    <svg viewBox="0 0 24 24" fill="none" width="12" height="12">
      <rect x="2" y="6" width="20" height="12" rx="3" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M10 9l5 3-5 3V9z" fill="currentColor"/>
    </svg>
  ),
  Arrow: () => (
    <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
      <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

export default async function ClipsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const tab = params.tab && ["all", "ready", "posted", "pending"].includes(params.tab) ? params.tab : "all";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: allClips } = await supabase
    .from("clips")
    .select("*")
    .eq("user_id", user.id)
    .in("status", ["ready", "processing", "failed", "deleted"])
    .order("created_at", { ascending: false });

  const clips = (allClips ?? []).filter((c) => c.status === "ready");
  const processingClips = (allClips ?? []).filter((c) => c.status === "processing");
  const failedClips = (allClips ?? []).filter((c) => c.status === "failed");
  const hasProcessing = processingClips.length > 0;

  const [{ data: connections }, usage] = await Promise.all([
    supabase.from("social_connections").select("platform").eq("user_id", user.id),
    getUserUsage(user.id, supabase),
  ]);
  const isYouTubeConnected = connections?.some((c) => c.platform === "youtube") ?? false;
  const isPro = usage.plan === "pro";

  const clipIds = clips.map((c) => c.id);
  const { data: socialPosts } = clipIds.length > 0
    ? await supabase.from("social_posts").select("clip_id, platform, platform_url, platform_video_id").eq("user_id", user.id).in("clip_id", clipIds)
    : { data: [] };

  const ytPostMap = new Map(
    (socialPosts ?? []).filter((p) => p.platform === "youtube").map((p) => [p.clip_id, p.platform_url])
  );
  const totalPosted = ytPostMap.size;

  // Ungenerated peaks (moments detected but no clip yet)
  const { data: vods } = await supabase
    .from("vods")
    .select("id, title, peak_data, duration_seconds")
    .eq("user_id", user.id)
    .eq("status", "ready")
    .not("peak_data", "is", null)
    .order("stream_date", { ascending: false });

  const generatedKeys = new Set(
    (allClips ?? [])
      .filter((c) => c.status === "ready" || c.status === "processing")
      .map((c) => `${c.vod_id}-${c.start_time_seconds}`)
  );
  const ungeneratedPeaks: (Peak & { vodTitle: string; vodId: string; peakIndex: number })[] = [];
  for (const vod of vods ?? []) {
    const peaks = (vod.peak_data as Peak[]) ?? [];
    for (let pi = 0; pi < peaks.length; pi++) {
      const key = `${vod.id}-${Math.round(peaks[pi].start)}`;
      if (!generatedKeys.has(key)) {
        ungeneratedPeaks.push({ ...peaks[pi], vodTitle: vod.title, vodId: vod.id, peakIndex: pi });
      }
    }
  }
  ungeneratedPeaks.sort((a, b) => b.score - a.score);

  // Filter
  let filteredReady = clips;
  let showPending = false;
  if (tab === "ready") {
    filteredReady = clips.filter((c) => !ytPostMap.has(c.id));
  } else if (tab === "posted") {
    filteredReady = clips.filter((c) => ytPostMap.has(c.id));
  } else if (tab === "pending") {
    filteredReady = [];
    showPending = true;
  }
  const showReadyAndPending = tab === "all";

  const totalCounts = {
    all: clips.length + processingClips.length + failedClips.length + ungeneratedPeaks.length,
    ready: clips.filter((c) => !ytPostMap.has(c.id)).length,
    posted: totalPosted,
    pending: ungeneratedPeaks.length,
  };

  const TAB_ITEMS: Array<[string, string, number]> = [
    ["all", "All", totalCounts.all],
    ["ready", "Ready", totalCounts.ready],
    ["posted", "Posted", totalCounts.posted],
    ["pending", "Pending", totalCounts.pending],
  ];

  const hasAnything = clips.length > 0 || processingClips.length > 0 || failedClips.length > 0 || ungeneratedPeaks.length > 0;

  return (
    <>
      <VodStatusPoller hasProcessing={hasProcessing} />

      {/* Header */}
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div className="page-head">
          <span className="page-eyebrow">§ 03 · Highlights</span>
          <h1 className="page-title">Clips</h1>
          <p className="page-sub">Auto-detected moments, ready to clip and post.</p>
        </div>
        <div className="row gap-md">
          {totalPosted > 0 && (
            <span className="rank-chip rising"><Icons.YT /> {totalPosted} posted to YouTube</span>
          )}
        </div>
      </div>

      {/* Connect YouTube nudge */}
      {hasAnything && !isYouTubeConnected && (
        <div className="card" style={{ borderColor: "color-mix(in oklab, var(--blue) 30%, var(--line))" }}>
          <div className="row card-pad-sm" style={{ justifyContent: "space-between", gap: 16 }}>
            <div className="row gap-sm">
              <span className="mono-label" style={{ color: "var(--blue)" }}>Connect YouTube</span>
              <span style={{ fontSize: 13.5, color: "var(--ink-2)" }}>to post Shorts directly from your clips.</span>
            </div>
            <Link href="/dashboard/connections" className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 12 }}>
              Connect <Icons.Arrow />
            </Link>
          </div>
        </div>
      )}

      {!hasAnything ? (
        <div className="card card-pad" style={{ textAlign: "center", padding: "48px 24px" }}>
          <p style={{ color: "var(--ink-3)", fontSize: 14, margin: 0 }}>
            No clip moments yet. Analyze a stream from <Link href="/dashboard/vods" style={{ color: "var(--blue)" }}>VODs</Link> and your best moments will appear here.
          </p>
        </div>
      ) : (
        <>
          {/* Filter tabs */}
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="tabs">
              {TAB_ITEMS.map(([k, l, c]) => (
                <Link key={k} href={`/dashboard/clips${k === "all" ? "" : `?tab=${k}`}`} className={`tab ${tab === k ? "active" : ""}`}>
                  {l} · {c}
                </Link>
              ))}
            </div>
          </div>

          {/* Generating clips */}
          {(tab === "all" || tab === "ready") && processingClips.length > 0 && (
            <>
              {filteredReady.length > 0 && (
                <div className="row" style={{ alignItems: "center", gap: 14 }}>
                  <span className="mono-label" style={{ color: "var(--blue)" }}>Generating now</span>
                  <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
                {processingClips.map((c) => (
                  <div key={c.id} className="clip-card">
                    <div className="clip-thumb" style={{ background: "color-mix(in oklab, var(--blue) 8%, var(--surface))" }}>
                      <span className="ts">{formatTimestamp(c.start_time_seconds as number | null)}</span>
                      <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
                        <span className="mono" style={{ fontSize: 11, color: "var(--blue)", letterSpacing: ".06em" }}>generating…</span>
                      </span>
                    </div>
                    <div className="clip-meta">
                      <b>{(c.title as string) || "Clip"}</b>
                      <span>{(c.category as string) ? categoryLabel(c.category as string) : "MOMENT"}</span>
                    </div>
                    <div style={{ padding: "0 12px 12px" }}>
                      <span className="chip" style={{ width: "100%", justifyContent: "center", color: "var(--blue)" }}>Processing…</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Ready clips grid */}
          {filteredReady.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
              {filteredReady.map((c) => {
                const ytUrl = ytPostMap.get(c.id);
                const score = Math.round(((c.score as number | null) ?? 0) * 100);
                return (
                  <div key={c.id} className="clip-card">
                    <div className="clip-thumb">
                      {c.video_url && (
                        <video
                          src={c.video_url as string}
                          preload="metadata"
                          muted
                          playsInline
                          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      )}
                      <span className="ts">{formatTimestamp(c.start_time_seconds as number | null)}</span>
                      <a href={c.video_url as string | undefined} target="_blank" rel="noopener noreferrer" className="play"><Icons.Play /></a>
                      <span className="score" style={{ color: scoreColorVar(score) }}>
                        {score}<span style={{ opacity: 0.6, fontSize: 9 }}>/100</span>
                      </span>
                    </div>
                    <div className="clip-meta">
                      <b>{(c.title as string) || "Clip"}</b>
                      <span>{(c.category as string) ? categoryLabel(c.category as string) : "MOMENT"}</span>
                    </div>
                    <div style={{ padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                      <PostToYouTube clipId={c.id} isConnected={isYouTubeConnected} existingUrl={ytUrl} />
                      {isPro
                        ? <ExportClipButton clipId={c.id} clipTitle={(c.title as string) || "Clip"} />
                        : <DownloadClip clipId={c.id} />
                      }
                      <ClipPerformanceLogger
                        clipId={c.id}
                        initialViews={(c.views_count as number | null) ?? null}
                        initialFollows={(c.follows_gained as number | null) ?? null}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Failed clips */}
          {(tab === "all" || tab === "ready") && failedClips.length > 0 && (
            <>
              <div className="row" style={{ alignItems: "center", gap: 14 }}>
                <span className="mono-label" style={{ color: "var(--danger)" }}>Failed — tap to retry</span>
                <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
                {failedClips.map((c) => (
                  <FailedClipCard
                    key={c.id}
                    clipId={c.id}
                    vodId={c.vod_id as string}
                    startSeconds={c.start_time_seconds as number}
                    title={(c.title as string) || "Clip"}
                    category={(c.category as string) ? categoryLabel(c.category as string) : "MOMENT"}
                    timestamp={formatTimestamp(c.start_time_seconds as number | null)}
                  />
                ))}
              </div>
            </>
          )}

          {/* Ungenerated peaks (Pending) */}
          {(showPending || (showReadyAndPending && ungeneratedPeaks.length > 0)) && (
            <>
              {showReadyAndPending && filteredReady.length > 0 && (
                <div className="row" style={{ alignItems: "center", gap: 14, marginTop: 8 }}>
                  <span className="mono-label">Pending — moments to clip</span>
                  <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                </div>
              )}
              {ungeneratedPeaks.length === 0 && showPending ? (
                <div className="card card-pad" style={{ textAlign: "center", padding: "48px 24px" }}>
                  <p style={{ color: "var(--ink-3)", fontSize: 14, margin: 0 }}>No pending moments — all detected clips have been generated.</p>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
                  {ungeneratedPeaks.map((p, idx) => (
                    <div key={`${p.vodId}-${p.peakIndex}-${idx}`} className="clip-card">
                      <div className="clip-thumb">
                        <span className="ts">{formatTimestamp(p.start)}</span>
                        <span className="play"><Icons.Plus /></span>
                      </div>
                      <div className="clip-meta">
                        <b>{p.title}</b>
                        <span>{categoryLabel(p.category)} · {p.vodTitle}</span>
                      </div>
                      <div style={{ padding: "0 12px 12px" }}>
                        <GenerateClipButton vodId={p.vodId} peakIndex={p.peakIndex} hasProcessing={hasProcessing} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
