import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SyncButton } from "@/components/dashboard/sync-button";
import { AnalyzeButton } from "@/components/dashboard/analyze-button";
import { VodStatusPoller } from "@/components/dashboard/vod-status-poller";
import { NotificationPrompt } from "@/components/dashboard/notification-prompt";
import { getUserUsage } from "@/lib/limits";
import { scoreColorVar } from "@/lib/score-utils";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const Icons = {
  Search: () => (
    <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  Play: () => (
    <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
      <path d="M7 5l12 7-12 7V5z" fill="currentColor"/>
    </svg>
  ),
  Chev: () => (
    <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

const TAB_LABELS: Array<[string, string]> = [
  ["all", "All"],
  ["ready", "Analyzed"],
  ["pending", "Queued"],
  ["analyzing", "Analyzing"],
];

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

  const { data: vods } = await supabase
    .from("vods")
    .select("id, title, duration_seconds, status, stream_date, analyzed_at, created_at, coach_report, thumbnail_url, failed_reason")
    .eq("user_id", user.id)
    .order("stream_date", { ascending: false });

  const vodList = vods ?? [];
  const hasProcessing = vodList.some((v) => v.status === "transcribing" || v.status === "analyzing");
  const analyzedList = vodList.filter((v) => v.status === "ready");
  const totalAnalyzed = analyzedList.length;
  const avgScore = totalAnalyzed > 0
    ? Math.round(
        analyzedList.reduce((acc, v) => acc + ((v.coach_report as { overall_score?: number } | null)?.overall_score ?? 0), 0) / totalAnalyzed
      )
    : 0;

  // Clips count (lifetime ready)
  const { count: clipsCount } = await supabase
    .from("clips")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "ready");

  // Quota (analyses this month)
  const usage = await getUserUsage(user.id, supabase);
  const quotaUsed = usage.analyses_this_month;
  const quotaTotal = usage.plan === "pro" ? 20 : 1;
  const quotaPct = Math.min(100, Math.round((quotaUsed / quotaTotal) * 100));

  // Filter VODs by tab — group transcribing+analyzing under "analyzing"
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
          <h1 className="page-title">VODs</h1>
          <p className="page-sub">Your Twitch streams, analyzed and scored.</p>
        </div>
        {vodList.length > 0 && (
          <div className="row gap-md">
            <SyncButton />
          </div>
        )}
      </div>

      {/* Stat row — only shown once there are VODs */}
      {vodList.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          <div className="card card-pad-sm">
            <div className="mono-label">Total analyzed</div>
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", marginTop: 4, color: "var(--ink)" }}>{totalAnalyzed}</div>
          </div>
          <div className="card card-pad-sm">
            <div className="mono-label">Avg score</div>
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", marginTop: 4, color: scoreColorVar(avgScore) }}>
              {avgScore}<span style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 500 }}>/100</span>
            </div>
          </div>
          <div className="card card-pad-sm">
            <div className="mono-label">Clips made</div>
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", marginTop: 4, color: "var(--green)" }}>{clipsCount ?? 0}</div>
          </div>
          <div className="card card-pad-sm" style={{ borderColor: "color-mix(in oklab, var(--blue) 30%, var(--line))" }}>
            <div className="mono-label" style={{ color: "var(--blue)" }}>Quota · {usage.plan === "pro" ? "Pro plan" : "Free plan"}</div>
            <div className="row" style={{ marginTop: 8, alignItems: "center", gap: 10 }}>
              <div className="prog" style={{ flex: 1 }}><span style={{ width: `${quotaPct}%` }} /></div>
              <span className="mono" style={{ fontSize: 12, color: "var(--ink-2)" }}>{quotaUsed}/{quotaTotal}</span>
            </div>
          </div>
        </div>
      )}

      {/* Empty onboarding state */}
      {vodList.length === 0 ? (
        <div className="card card-pad" style={{ padding: "48px 40px", textAlign: "center" }}>
          <p className="mono-label" style={{ marginBottom: 20, letterSpacing: ".08em" }}>GET STARTED</p>
          <div className="row" style={{ justifyContent: "center", gap: 0, marginBottom: 32, flexWrap: "wrap" }}>
            {[
              { n: "1", label: "Sync your VODs" },
              { n: "2", label: "Click Analyze" },
              { n: "3", label: "Get your report" },
            ].map(({ n, label }, i, arr) => (
              <div key={n} className="row" style={{ alignItems: "center", gap: 0 }}>
                <div style={{ textAlign: "center", padding: "0 20px" }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: "color-mix(in oklab, var(--blue) 15%, var(--surface))",
                    border: "1px solid color-mix(in oklab, var(--blue) 35%, var(--line))",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 8px",
                    fontSize: 13, fontWeight: 700, color: "var(--blue)",
                  }}>{n}</div>
                  <span style={{ fontSize: 12, color: "var(--ink-2)", fontWeight: 500 }}>{label}</span>
                </div>
                {i < arr.length - 1 && (
                  <div style={{ width: 32, height: 1, background: "var(--line)", flexShrink: 0 }} />
                )}
              </div>
            ))}
          </div>
          <p style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 24, maxWidth: 360, margin: "0 auto 24px" }}>
            Pull in your last 20 Twitch streams in seconds, then pick one to analyze.
          </p>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <SyncButton />
          </div>
        </div>
      ) : (
        <>
        {/* Filter row */}
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="tabs">
            {TAB_LABELS.map(([k, l]) => (
              <Link key={k} href={`/dashboard/vods${k === "all" ? "" : `?tab=${k}`}`} className={`tab ${tab === k ? "active" : ""}`}>
                {l}
              </Link>
            ))}
          </div>
        </div>

        {/* VOD list */}
        {filtered.length === 0 ? (
          <div className="card card-pad" style={{ textAlign: "center", padding: "48px 24px" }}>
            <p style={{ color: "var(--ink-3)", fontSize: 14, margin: 0 }}>No VODs match this filter.</p>
          </div>
        ) : (
        <div className="card">
          {filtered.map((v, i) => {
            const score = (v.coach_report as { overall_score?: number } | null)?.overall_score ?? null;
            const isProcessing = v.status === "transcribing" || v.status === "analyzing";
            // Failed VODs need a retry path too — the API accepts both
            // pending and failed for analyze.
            const showAnalyzeButton = v.status === "pending" || v.status === "failed";
            const requiresPro = usage.plan !== "pro" && (v.duration_seconds ?? 0) > 14400;

            return (
              <div
                key={v.id}
                style={{
                  padding: "16px 22px",
                  borderBottom: i === filtered.length - 1 ? "none" : "1px solid var(--line)",
                  display: "grid",
                  gridTemplateColumns: "120px 1fr auto",
                  gap: 20,
                  alignItems: "center",
                }}
              >
                {/* thumb */}
                <Link
                  href={v.status === "ready" ? `/dashboard/vods/${v.id}` : `/dashboard/vods`}
                  style={{
                    width: 120,
                    height: 68,
                    borderRadius: 8,
                    background: "linear-gradient(135deg, oklch(0.26 0.08 290), oklch(0.11 0.025 265))",
                    position: "relative",
                    overflow: "hidden",
                    flexShrink: 0,
                    display: "block",
                  }}
                >
                  {v.thumbnail_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={(v.thumbnail_url as string).replace("%{width}", "320").replace("%{height}", "180")}
                      alt=""
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  )}
                  <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "rgba(255,255,255,.6)" }}>
                    <Icons.Play />
                  </div>
                  <span className="mono" style={{ position: "absolute", bottom: 6, right: 6, fontSize: 10, padding: "1px 5px", background: "rgba(0,0,0,.6)", borderRadius: 3, color: "#fff" }}>
                    {formatDuration(v.duration_seconds)}
                  </span>
                  {isProcessing && (
                    <div
                      style={{
                        position: "absolute",
                        top: 6,
                        left: 6,
                        fontSize: 10,
                        fontFamily: "var(--font-geist-mono), monospace",
                        padding: "2px 6px",
                        background: "var(--blue)",
                        borderRadius: 3,
                        color: "#fff",
                        textTransform: "uppercase",
                        letterSpacing: ".06em",
                      }}
                    >
                      analyzing…
                    </div>
                  )}
                </Link>

                {/* metadata */}
                <div className="col" style={{ gap: 6, minWidth: 0 }}>
                  <div className="row gap-sm" style={{ flexWrap: "wrap" }}>
                    <Link
                      href={v.status === "ready" ? `/dashboard/vods/${v.id}` : `/dashboard/vods`}
                      style={{
                        fontSize: 14.5,
                        fontWeight: 600,
                        color: "var(--ink)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {v.title}
                    </Link>
                    {v.status === "pending" && <span className="chip">queued</span>}
                    {v.status === "failed" && <span className="chip r">failed</span>}
                    {requiresPro && v.status === "pending" && (
                      <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 999, background: "rgba(34,211,238,0.1)", border: "1px solid rgba(34,211,238,0.25)", color: "#22D3EE", fontWeight: 600, letterSpacing: "0.05em" }}>
                        PRO
                      </span>
                    )}
                  </div>
                  <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)", letterSpacing: ".04em" }}>
                    {formatDate(v.stream_date ?? v.created_at)} · {formatDuration(v.duration_seconds)}
                  </span>
                  {v.status === "failed" && v.failed_reason && (
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--red, #ef4444)",
                        lineHeight: 1.4,
                        marginTop: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                      title={v.failed_reason as string}
                    >
                      {v.failed_reason as string}
                    </span>
                  )}
                </div>

                {/* right side — score / progress / analyze */}
                <div className="row gap-md">
                  {score !== null ? (
                    <div className="score-pill" style={{ color: scoreColorVar(score), fontSize: 22 }}>
                      {score}<small style={{ fontSize: 11 }}>/100</small>
                    </div>
                  ) : isProcessing ? (
                    <div className="mono" style={{ fontSize: 12, color: "var(--blue)" }}>processing…</div>
                  ) : showAnalyzeButton ? (
                    <AnalyzeButton
                      vodId={v.id}
                      status={v.status}
                      vodTitle={v.title}
                      durationSeconds={v.duration_seconds ?? 0}
                      hasProcessing={hasProcessing}
                      userPlan={usage.plan}
                    />
                  ) : null}
                  {v.status === "ready" && (
                    <Link href={`/dashboard/vods/${v.id}`} style={{ color: "var(--ink-3)" }}>
                      <Icons.Chev />
                    </Link>
                  )}
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
