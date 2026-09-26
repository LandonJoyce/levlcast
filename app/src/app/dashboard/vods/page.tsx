import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SyncButton } from "@/components/dashboard/sync-button";
import { AnalyzeButton } from "@/components/dashboard/analyze-button";
import { VodStatusPoller } from "@/components/dashboard/vod-status-poller";
import { NotificationPrompt } from "@/components/dashboard/notification-prompt";
import { FeedbackButton } from "@/components/dashboard/feedback-button";
import { getUserUsage } from "@/lib/limits";
import { isPlacementDelta } from "@/lib/rank";

/*
 * Every stream synced from Twitch, newest first, one row each. This was a
 * grid of tall cards: a big thumbnail (or an empty box saying "no clip
 * found"), a colored score, a quote and a row of clip buttons, three to a
 * row, so eight streams took three screens. The row keeps what tells you
 * which stream to open: when it was, how it went, and the coach's one
 * line. Clip buttons live on the stream page and in Clips.
 */

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * One specific line about this stream. Ordered by how specific it is, so
 * the row says the most concrete true thing in the report rather than
 * falling back to the same sentence on every stream.
 */
function streamLine(report: Record<string, unknown> | null): string | null {
  if (!report) return null;
  const punch = typeof report.punch_line === "string" ? report.punch_line.trim() : "";
  if (punch) return punch;
  const rec = typeof report.recommendation === "string" ? report.recommendation.trim() : "";
  if (rec) return rec.split(/(?<=[.!?])\s+/)[0] ?? rec;
  const deadPct = typeof report.dead_air_pct === "number" ? report.dead_air_pct : null;
  const deadSecs = typeof report.dead_air_seconds === "number" ? report.dead_air_seconds : null;
  if (deadPct !== null && deadPct >= 10 && deadSecs) {
    return `${Math.round(deadSecs / 60)} minutes of dead air, ${Math.round(deadPct)}% of the stream.`;
  }
  const improvements = Array.isArray(report.improvements) ? report.improvements : [];
  const first = improvements.find((s): s is string => typeof s === "string" && s.length > 0);
  return first ? first.replace(/\*\*/g, "").trim() : null;
}

const TABS = [
  ["all", "All"],
  ["ready", "Analyzed"],
  ["pending", "Not analyzed"],
] as const;

export default async function StreamsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const params = await searchParams;
  const tab = TABS.some(([k]) => k === params.tab) ? (params.tab as (typeof TABS)[number][0]) : "all";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [{ data: vods }, { data: clips }, usage] = await Promise.all([
    supabase
      .from("vods")
      .select("id, title, duration_seconds, status, stream_date, created_at, coach_report, thumbnail_url, failed_reason, rank_delta")
      .eq("user_id", user.id)
      .order("stream_date", { ascending: false }),
    supabase.from("clips").select("vod_id").eq("user_id", user.id).eq("status", "ready"),
    getUserUsage(user.id, supabase),
  ]);

  const list = vods ?? [];
  const clipCount = new Map<string, number>();
  for (const c of clips ?? []) clipCount.set(c.vod_id, (clipCount.get(c.vod_id) ?? 0) + 1);

  const isProcessing = (s: string) => s === "transcribing" || s === "analyzing";
  const hasProcessing = list.some((v) => isProcessing(v.status));
  const analyzed = list.filter((v) => v.status === "ready").length;
  const notAnalyzed = list.filter((v) => v.status === "pending" || v.status === "failed").length;

  const shown = list.filter((v) => {
    if (tab === "ready") return v.status === "ready";
    if (tab === "pending") return v.status === "pending" || v.status === "failed" || isProcessing(v.status);
    return true;
  });

  return (
    <>
      <VodStatusPoller hasProcessing={hasProcessing} />

      <div className="hm-hello">
        <div>
          <h1 className="page-title">Streams</h1>
          {list.length > 0 && (
            <p className="sl-sum">
              {analyzed} analyzed · {notAnalyzed} not analyzed
            </p>
          )}
        </div>
        {list.length > 0 && <SyncButton />}
      </div>

      {/* Only worth asking while there's a report on the way. */}
      {hasProcessing && <NotificationPrompt />}

      {list.length === 0 ? (
        <section className="sl-empty">
          <p className="sl-empty-title">Pull in your streams to get started.</p>
          <ol>
            <li>Sync your last 20 Twitch streams.</li>
            <li>Press Analyze on one.</li>
            <li>Get your report, your rank and your clips.</li>
          </ol>
          <SyncButton primary />
        </section>
      ) : (
        <>
          <nav className="sl-tabs" aria-label="Filter streams">
            {TABS.map(([k, label]) => (
              <Link
                key={k}
                href={`/dashboard/vods${k === "all" ? "" : `?tab=${k}`}`}
                aria-current={tab === k ? "page" : undefined}
              >
                {label}
              </Link>
            ))}
          </nav>

          {shown.length === 0 ? (
            <p className="sl-none">Nothing here.</p>
          ) : (
            <ul className="sl">
              {shown.map((v) => {
                const ready = v.status === "ready";
                const processing = isProcessing(v.status);
                const failed = v.status === "failed";
                const line = ready ? streamLine(v.coach_report as Record<string, unknown> | null) : null;
                const delta = (v.rank_delta as number | null) ?? null;
                const placed = delta !== null && isPlacementDelta(delta);
                const made = clipCount.get(v.id) ?? 0;
                const thumb = v.thumbnail_url
                  ? (v.thumbnail_url as string).replace("%{width}", "320").replace("%{height}", "180")
                  : null;
                const needsPro = usage.plan !== "pro" && (v.duration_seconds ?? 0) > 14400;
                const href = `/dashboard/vods/${v.id}`;

                return (
                  <li key={v.id} className="sl-row" data-status={v.status}>
                    <Link href={href} className="sl-thumb" tabIndex={-1} aria-hidden="true">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {thumb && <img src={thumb} alt="" width={320} height={180} loading="lazy" />}
                    </Link>

                    <div className="sl-main">
                      <Link href={href} className="sl-title">
                        {v.title}
                      </Link>
                      <p className="sl-meta">
                        {formatDate(v.stream_date ?? v.created_at)}
                        {v.duration_seconds ? ` · ${formatDuration(v.duration_seconds)}` : ""}
                        {made > 0 && ` · ${made} ${made === 1 ? "clip" : "clips"}`}
                      </p>
                      {line && <p className="sl-line">{line}</p>}
                      {processing && <p className="sl-line">Analyzing now. It keeps going if you leave.</p>}
                      {failed && (
                        <div className="sl-failed">
                          <p>{(v.failed_reason as string | null) || "The analysis didn't finish."}</p>
                          <FeedbackButton
                            label="Tell Landon what happened"
                            defaultCategory="failure"
                            trigger="vod-failed-card"
                            context={{
                              vodId: v.id,
                              vodTitle: v.title,
                              durationSeconds: v.duration_seconds,
                              failedReason: v.failed_reason,
                            }}
                            style="subtle"
                          />
                        </div>
                      )}
                    </div>

                    <div className="sl-end">
                      {ready ? (
                        <Link href={href} className="sl-res" data-r={placed ? "placed" : delta === null ? "none" : delta >= 0 ? "win" : "loss"}>
                          {placed ? (
                            <b>Placed</b>
                          ) : delta !== null ? (
                            <>
                              <b>{delta >= 0 ? "Win" : "Loss"}</b>
                              <span>{delta >= 0 ? `+${delta}` : `−${Math.abs(delta)}`}</span>
                            </>
                          ) : (
                            <b>Report</b>
                          )}
                          <ChevronRight size={16} aria-hidden="true" />
                        </Link>
                      ) : processing ? (
                        <span className="sl-busy">Analyzing</span>
                      ) : (
                        <div className="sl-analyze">
                          {needsPro && v.status === "pending" && <span className="sl-pro">Pro</span>}
                          <AnalyzeButton
                            vodId={v.id}
                            status={v.status}
                            vodTitle={v.title}
                            durationSeconds={v.duration_seconds ?? 0}
                            hasProcessing={hasProcessing}
                            userPlan={usage.plan}
                          />
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </>
  );
}
