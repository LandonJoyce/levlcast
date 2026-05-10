import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SyncButton } from "@/components/dashboard/sync-button";
import { AnalyzeButton } from "@/components/dashboard/analyze-button";
import { VodStatusPoller } from "@/components/dashboard/vod-status-poller";
import { NotificationPrompt } from "@/components/dashboard/notification-prompt";
import { getUserUsage } from "@/lib/limits";
import { scoreColorHex } from "@/lib/score-utils";
import { DownloadClip, CopyCaption, PostToYouTube } from "@/components/dashboard/clip-actions";

function formatDate(iso: string | null): string {
  if (!iso) return "...";
  const d = new Date(iso);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString("en-US", {
    month: "short", day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "...";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const Icons = {
  Play: () => (
    <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
      <path d="M7 5l12 7-12 7V5z" fill="currentColor"/>
    </svg>
  ),
  Arrow: () => (
    <svg viewBox="0 0 24 24" fill="none" width="12" height="12">
      <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Chev: () => (
    <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Scissors: () => (
    <svg viewBox="0 0 24 24" fill="none" width="13" height="13">
      <circle cx="6" cy="6" r="3" stroke="currentColor" strokeWidth="1.6"/>
      <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M8.12 8.12L22 22M8.12 15.88L22 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
};

export default async function VodsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const tab = params.tab && ["all", "ready", "pending", "analyzing"].includes(params.tab)
    ? params.tab
    : "all";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [{ data: vods }, { data: allClips }, { data: connections }] = await Promise.all([
    supabase
      .from("vods")
      .select("id, title, duration_seconds, status, stream_date, analyzed_at, created_at, coach_report, thumbnail_url, failed_reason")
      .eq("user_id", user.id)
      .order("stream_date", { ascending: false }),
    supabase
      .from("clips")
      .select("id, vod_id, video_url, title, caption_text, peak_score, status")
      .eq("user_id", user.id)
      .eq("status", "ready")
      .order("peak_score", { ascending: false }),
    supabase
      .from("social_connections")
      .select("platform")
      .eq("user_id", user.id),
  ]);

  const vodList = vods ?? [];
  const hasProcessing = vodList.some((v) => v.status === "transcribing" || v.status === "analyzing");
  const analyzedList = vodList.filter((v) => v.status === "ready");

  // Best clip per VOD (clips are ordered by peak_score desc, so first match wins)
  const bestClipByVod: Record<string, typeof allClips extends (infer T)[] | null ? T : never> = {};
  for (const clip of allClips ?? []) {
    if (!bestClipByVod[clip.vod_id]) bestClipByVod[clip.vod_id] = clip;
  }

  const isYouTubeConnected = connections?.some((c) => c.platform === "youtube") ?? false;

  const usage = await getUserUsage(user.id, supabase);
  const quotaUsed = usage.analyses_used;
  const quotaTotal = usage.analyses_limit;
  const quotaPct = Math.min(100, Math.round((quotaUsed / quotaTotal) * 100));

  const filtered = vodList.filter((v) => {
    if (tab === "all") return true;
    if (tab === "analyzing") return v.status === "transcribing" || v.status === "analyzing";
    return v.status === tab;
  });


  return (
    <>
      <VodStatusPoller hasProcessing={hasProcessing} />
      <NotificationPrompt />

      {/* Header */}
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div className="page-head">
          <span className="page-eyebrow">§ 02 · Library</span>
          <h1 className="page-title">Your Streams</h1>
          <p className="page-sub">Best clip and key takeaway from each stream.</p>
        </div>
        {vodList.length > 0 && <SyncButton />}
      </div>

      {/* Quota strip */}
      {vodList.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 16px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10 }}>
          <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
            {usage.on_trial ? "Free trial" : usage.plan === "pro" ? "Pro plan" : "Free plan"} · {quotaUsed}/{quotaTotal} analyses {usage.period_label}
          </span>
          <div className="prog" style={{ flex: 1, maxWidth: 160 }}>
            <span style={{ width: `${quotaPct}%` }} />
          </div>
          <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
            {analyzedList.length} analyzed
          </span>
        </div>
      )}

      {/* Empty state */}
      {vodList.length === 0 ? (
        <div className="card card-pad" style={{ padding: "48px 40px", textAlign: "center" }}>
          <p className="mono-label" style={{ marginBottom: 20, letterSpacing: ".08em" }}>GET STARTED</p>
          <div className="row" style={{ justifyContent: "center", gap: 0, marginBottom: 32, flexWrap: "wrap" }}>
            {[
              { n: "1", label: "Sync your VODs" },
              { n: "2", label: "Click Analyze" },
              { n: "3", label: "Get your clip" },
            ].map(({ n, label }, i, arr) => (
              <div key={n} className="row" style={{ alignItems: "center", gap: 0 }}>
                <div style={{ textAlign: "center", padding: "0 20px" }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: "color-mix(in oklab, var(--blue) 15%, var(--surface))",
                    border: "1px solid color-mix(in oklab, var(--blue) 35%, var(--line))",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 8px", fontSize: 13, fontWeight: 700, color: "var(--blue)",
                  }}>{n}</div>
                  <span style={{ fontSize: 12, color: "var(--ink-2)", fontWeight: 500 }}>{label}</span>
                </div>
                {i < arr.length - 1 && <div style={{ width: 32, height: 1, background: "var(--line)", flexShrink: 0 }} />}
              </div>
            ))}
          </div>
          <p style={{ fontSize: 13, color: "var(--ink-3)", margin: "0 auto 24px", maxWidth: 360 }}>
            Pull in your last 20 Twitch streams, pick one to analyze, and get your best clip ready to post.
          </p>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <SyncButton />
          </div>
        </div>
      ) : (
        <>
          {/* Filter tabs */}
          <div className="tabs">
            {([["all", "All"], ["ready", "Analyzed"], ["pending", "Queued"], ["analyzing", "Analyzing"]] as const).map(([k, l]) => (
              <Link key={k} href={`/dashboard/vods${k === "all" ? "" : `?tab=${k}`}`} className={`tab ${tab === k ? "active" : ""}`}>
                {l}
              </Link>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="card card-pad" style={{ textAlign: "center", padding: "48px 24px" }}>
              <p style={{ color: "var(--ink-3)", fontSize: 14, margin: 0 }}>No VODs match this filter.</p>
            </div>
          )}

          {/* VOD card grid — analyzed AND unanalyzed mixed chronologically.
              Previously the big panels only showed analyzed VODs and brand-new
              synced streams sat in a separate compact list below, so users
              didn't see their latest stream where they expected it. Unified
              into one grid; the card renders an analyze CTA when there's no
              coach report yet, otherwise the score + punch line + clip
              actions. */}
          {filtered.length > 0 && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: 20,
            }}>
              {filtered.map((v) => {
                const report = v.coach_report as any;
                const score = report?.overall_score as number | null ?? null;
                const punchLine = report?.punch_line as string | null ?? null;
                const clip = bestClipByVod[v.id] ?? null;
                const scoreColor = score !== null ? scoreColorHex(score) : "#A6B3C9";
                const isReady = v.status === "ready";
                const isProcessing = v.status === "transcribing" || v.status === "analyzing";
                const showAnalyzeButton = v.status === "pending" || v.status === "failed";
                const requiresPro = usage.plan !== "pro" && (v.duration_seconds ?? 0) > 14400;

                const thumbBg = v.thumbnail_url
                  ? `url(${(v.thumbnail_url as string).replace("%{width}", "640").replace("%{height}", "360")}) center/cover`
                  : "linear-gradient(135deg, oklch(0.26 0.08 290), oklch(0.11 0.025 265))";

                return (
                  <div key={v.id} style={{
                    background: "var(--surface)",
                    border: "1px solid var(--line)",
                    borderRadius: 14,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                  }}>
                    {/* Thumbnail — static, always. Click to go to punch page. */}
                    <Link href={`/dashboard/vods/${v.id}`} style={{ display: "block", flexShrink: 0, position: "relative" }}>
                      <div style={{
                        width: "100%", aspectRatio: "16/9",
                        background: thumbBg,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        position: "relative",
                      }}>
                        {/* Clip ready badge */}
                        {clip && (
                          <div style={{
                            position: "absolute", bottom: 10, left: 10,
                            background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)",
                            borderRadius: 6, padding: "4px 10px",
                            fontFamily: "var(--font-geist-mono), monospace",
                            fontSize: 11, fontWeight: 600, color: "#A3E635",
                            letterSpacing: "0.04em",
                          }}>
                            Clip ready
                          </div>
                        )}
                        {/* No clip label */}
                        {!clip && !v.thumbnail_url && (
                          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-geist-mono), monospace", letterSpacing: "0.06em" }}>
                            no clip found
                          </span>
                        )}
                        {!clip && v.thumbnail_url && (
                          <div style={{
                            position: "absolute", bottom: 10, left: 10,
                            background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)",
                            borderRadius: 6, padding: "4px 10px",
                            fontFamily: "var(--font-geist-mono), monospace",
                            fontSize: 11, color: "rgba(255,255,255,0.45)",
                            letterSpacing: "0.04em",
                          }}>
                            no clip found
                          </div>
                        )}
                      </div>
                    </Link>

                    {/* Card body */}
                    <div style={{ padding: "16px 18px 18px", flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
                      {/* Score (analyzed) or status pill (unanalyzed) + title */}
                      <Link href={`/dashboard/vods/${v.id}`} style={{ display: "flex", alignItems: "flex-start", gap: 12, textDecoration: "none", color: "inherit" }}>
                        {isReady && score !== null ? (
                          <div style={{
                            fontFamily: "var(--font-geist-mono), monospace",
                            fontSize: 36, fontWeight: 800, lineHeight: 1,
                            color: scoreColor, letterSpacing: "-0.03em", flexShrink: 0,
                          }}>
                            {score}
                          </div>
                        ) : (
                          <div style={{
                            fontFamily: "var(--font-geist-mono), monospace",
                            fontSize: 11, fontWeight: 700, color: isProcessing ? "var(--blue)" : "var(--ink-3)",
                            letterSpacing: "0.08em", flexShrink: 0,
                            background: "var(--surface-2)", border: "1px solid var(--line)",
                            padding: "4px 8px", borderRadius: 6, textTransform: "uppercase", marginTop: 2,
                          }}>
                            {isProcessing ? "Analyzing" : v.status === "failed" ? "Failed" : "New"}
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", margin: "0 0 2px", lineHeight: 1.3,
                            overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box",
                            WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>
                            {v.title}
                          </p>
                          <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                            {formatDate(v.stream_date ?? v.created_at)} · {formatDuration(v.duration_seconds)}
                          </span>
                        </div>
                      </Link>

                      {/* Punch line for analyzed; status note for unanalyzed */}
                      {isReady ? (
                        punchLine ? (
                          <p style={{
                            fontSize: 14, lineHeight: 1.5, color: "var(--ink)",
                            margin: 0, fontWeight: 500,
                            borderLeft: `3px solid ${scoreColor}`,
                            paddingLeft: 12,
                          }}>
                            {punchLine}
                          </p>
                        ) : (
                          <p style={{ fontSize: 13, color: "var(--ink-3)", margin: 0, lineHeight: 1.5 }}>
                            Open for your full coaching breakdown.
                          </p>
                        )
                      ) : isProcessing ? (
                        <p style={{ fontSize: 13, color: "var(--ink-3)", margin: 0, lineHeight: 1.5 }}>
                          Working on your coach report — usually about five minutes.
                        </p>
                      ) : v.status === "failed" && v.failed_reason ? (
                        <p style={{ fontSize: 13, color: "var(--danger)", margin: 0, lineHeight: 1.5 }}>
                          {v.failed_reason as string}
                        </p>
                      ) : (
                        <p style={{ fontSize: 13, color: "var(--ink-3)", margin: 0, lineHeight: 1.5 }}>
                          Run the analysis to get your coach report and best clip.
                        </p>
                      )}

                      {/* Actions */}
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginTop: "auto", paddingTop: 4 }}>
                        {isReady && clip && (
                          <>
                            <DownloadClip clipId={clip.id} />
                            <CopyCaption caption={clip.caption_text} />
                            <PostToYouTube clipId={clip.id} isConnected={isYouTubeConnected} />
                          </>
                        )}
                        {!isReady && showAnalyzeButton && (
                          <AnalyzeButton
                            vodId={v.id}
                            status={v.status}
                            vodTitle={v.title}
                            durationSeconds={v.duration_seconds ?? 0}
                            hasProcessing={hasProcessing}
                            userPlan={usage.plan}
                          />
                        )}
                        {!isReady && requiresPro && v.status === "pending" && (
                          <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 999, background: "color-mix(in oklab, var(--blue) 14%, var(--surface-2))", border: "1px solid color-mix(in oklab, var(--blue) 35%, var(--line))", color: "var(--blue)", fontWeight: 600 }}>
                            PRO
                          </span>
                        )}
                        <div style={{ flex: 1 }} />
                        <Link
                          href={`/dashboard/vods/${v.id}`}
                          style={{ fontSize: 12, color: "var(--ink-3)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}
                        >
                          Open <Icons.Arrow />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );
}
