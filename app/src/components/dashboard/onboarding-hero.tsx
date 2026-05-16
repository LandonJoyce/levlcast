/**
 * OnboardingHero — the centerpiece a new user sees on the dashboard
 * before their first coach report exists.
 *
 * Three states, picked by which best matches the user's data:
 *   1. "analyzing"  — auth callback's auto-analyze is in flight. Live
 *                     progress card + the parent page polls every 5s
 *                     and reloads when status flips to "ready".
 *   2. "no-streams" — Twitch returned zero VODs (new streamer or all
 *                     VODs aged out). Sample report link + a friendly
 *                     "after your next stream, hit Sync" message.
 *   3. "synced"     — VODs exist but none are running. Falls back to
 *                     the classic "Pick a stream" CTA so the user
 *                     can still kick analysis off manually.
 *
 * Stays a server component so it can read fresh state from Supabase
 * on every refresh. The polling on the parent page is what makes the
 * UI feel alive — no client websocket needed.
 */

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

interface VodInProgress {
  id: string;
  title: string | null;
  duration_seconds: number | null;
  status: string;
  created_at: string;
}

interface Props {
  /** Display name from profile. Used in the greeting. */
  name: string;
}

const Icons = {
  Twitch: () => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
      <path d="M4 5l2-3h14v12l-5 5h-4l-3 3H6v-3H2V8l2-3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="M11 8v5M16 8v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  Arrow: () => (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none">
      <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Check: () => (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none">
      <path d="M4 12l5 5L20 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

export async function OnboardingHero({ name }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Two cheap queries: in-progress VOD (if any) and total VOD count.
  // Total count drives the "no streams found" branch; the in-progress
  // row drives the "analyzing" branch.
  const [inProgressResult, countResult] = await Promise.all([
    supabase
      .from("vods")
      .select("id, title, duration_seconds, status, created_at")
      .eq("user_id", user.id)
      .in("status", ["transcribing", "analyzing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("vods")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  const inProgress = inProgressResult.data as VodInProgress | null;
  const totalVods = countResult.count ?? 0;

  if (inProgress) {
    return <AnalyzingState vod={inProgress} name={name} />;
  }

  if (totalVods === 0) {
    return <NoStreamsState name={name} />;
  }

  return <SyncedState name={name} />;
}

/**
 * Live progress card — shown while the auto-queued first analysis runs.
 * Parent page is responsible for polling; this component just renders the
 * current snapshot. Pulse animation telegraphs that something is happening
 * even between page refreshes.
 */
function AnalyzingState({ vod, name }: { vod: VodInProgress; name: string }) {
  const minutes = vod.duration_seconds ? Math.round(vod.duration_seconds / 60) : null;
  const title = vod.title ?? "your last stream";
  const isTranscribing = vod.status === "transcribing";

  return (
    <div className="card bordered accent-blue" style={{ padding: 0, overflow: "hidden", position: "relative" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(600px 280px at 50% 0%, color-mix(in oklab, var(--blue) 18%, transparent), transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ padding: "40px 32px 36px", position: "relative" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "5px 12px",
            borderRadius: 999,
            background: "color-mix(in oklab, var(--blue-soft) 50%, transparent)",
            border: "1px solid color-mix(in oklab, var(--blue) 35%, transparent)",
            color: "var(--blue)",
            fontFamily: "var(--font-geist-mono), monospace",
            fontSize: 11,
            letterSpacing: ".06em",
            textTransform: "uppercase",
            marginBottom: 18,
          }}
        >
          <PulseDot />
          Your first report is being made
        </div>

        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.15, margin: "0 0 8px", color: "var(--ink)" }}>
          Hang tight, {name}. We&apos;re reading your last stream.
        </h2>
        <p style={{ margin: "0 0 24px", color: "var(--ink-2)", fontSize: 14, lineHeight: 1.55, maxWidth: "60ch" }}>
          {title}
          {minutes ? ` · ${minutes} min` : ""}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 480 }}>
          <Stage state="done" label="Pulled from Twitch" />
          <Stage state={isTranscribing ? "active" : "done"} label="Transcribing the audio" />
          <Stage state={isTranscribing ? "queued" : "active"} label="Writing your coach report" />
        </div>

        <p style={{ marginTop: 22, color: "var(--ink-3)", fontSize: 12.5, lineHeight: 1.5 }}>
          Takes ~5 minutes for most streams. You can leave this tab open
          or close it — we&apos;ll send a notification when it&apos;s ready.
        </p>
      </div>
    </div>
  );
}

/** "We didn't find anything on your Twitch yet." */
function NoStreamsState({ name }: { name: string }) {
  return (
    <div className="card bordered accent-blue" style={{ padding: 0, overflow: "hidden", position: "relative" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(600px 280px at 50% 0%, color-mix(in oklab, var(--blue) 14%, transparent), transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div style={{ padding: "40px 32px 36px", position: "relative", textAlign: "center" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "5px 12px",
            borderRadius: 999,
            background: "var(--surface-2)",
            border: "1px solid var(--line)",
            color: "var(--ink-3)",
            fontFamily: "var(--font-geist-mono), monospace",
            fontSize: 11,
            letterSpacing: ".06em",
            textTransform: "uppercase",
            marginBottom: 18,
          }}
        >
          No recent VODs on Twitch
        </div>

        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.15, margin: "0 0 10px", color: "var(--ink)" }}>
          Welcome, {name}. Stream once and we&apos;re off.
        </h2>
        <p style={{ margin: "0 auto 24px", color: "var(--ink-2)", fontSize: 14.5, lineHeight: 1.55, maxWidth: "54ch" }}>
          Twitch doesn&apos;t have any recent broadcasts on file for your account.
          As soon as your next stream ends, come back and hit Sync — your first
          coach report is 5 minutes away.
        </p>

        <div style={{ display: "inline-flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          <Link href="/demo" className="btn btn-blue" style={{ textDecoration: "none" }}>
            See a sample report <Icons.Arrow />
          </Link>
          <Link
            href="/dashboard/vods"
            className="btn"
            style={{
              padding: "9px 16px",
              border: "1px solid var(--line)",
              background: "var(--surface-2)",
              color: "var(--ink)",
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 8,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Icons.Twitch /> Check Twitch again
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Fallback for users who have VODs but nothing is auto-analyzing. */
function SyncedState({ name }: { name: string }) {
  return (
    <div className="card bordered accent-blue" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "48px 32px", textAlign: "center", position: "relative" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(600px 280px at 50% 0%, color-mix(in oklab, var(--blue) 18%, transparent), transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "5px 12px",
              borderRadius: 999,
              background: "color-mix(in oklab, var(--blue-soft) 50%, transparent)",
              border: "1px solid color-mix(in oklab, var(--blue) 35%, transparent)",
              color: "var(--blue)",
              fontFamily: "var(--font-geist-mono), monospace",
              fontSize: 11,
              letterSpacing: ".06em",
              textTransform: "uppercase",
              marginBottom: 18,
            }}
          >
            Pick a stream
          </div>
          <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.1, margin: "0 0 10px", color: "var(--ink)" }}>
            Welcome, {name}. Your streams are synced.
          </h2>
          <p style={{ margin: "0 auto 24px", color: "var(--ink-2)", fontSize: 14.5, lineHeight: 1.55, maxWidth: "52ch" }}>
            Pick any stream from your VODs list and hit Analyze. The full read
            takes about five minutes.
          </p>
          <Link href="/dashboard/vods" className="btn btn-blue" style={{ textDecoration: "none" }}>
            <Icons.Twitch /> Pick a stream to analyze <Icons.Arrow />
          </Link>
        </div>
      </div>
    </div>
  );
}

/** One row of the progress checklist on the AnalyzingState card. */
function Stage({ state, label }: { state: "done" | "active" | "queued"; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13.5, color: state === "queued" ? "var(--ink-3)" : "var(--ink)" }}>
      <span
        aria-hidden
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: state === "done" ? "var(--green, #A3E635)" : state === "active" ? "color-mix(in oklab, var(--blue) 18%, var(--surface-2))" : "var(--surface-2)",
          border: state === "done" ? "none" : state === "active" ? "2px solid var(--blue)" : "2px solid var(--line)",
          color: state === "done" ? "#0A0A0F" : state === "active" ? "var(--blue)" : "var(--ink-3)",
          fontSize: 11,
          fontWeight: 800,
          flexShrink: 0,
        }}
      >
        {state === "done" ? <Icons.Check /> : state === "active" ? <SpinnerDot /> : ""}
      </span>
      <span>{label}</span>
    </div>
  );
}

/** Pulsing dot for the "in progress" eyebrow chip. CSS-only so this stays
 * a server component. */
function PulseDot() {
  return (
    <span
      aria-hidden
      style={{
        position: "relative",
        display: "inline-block",
        width: 8,
        height: 8,
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: PULSE_KEYFRAMES }} />
      <span
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: "var(--blue)",
          animation: "ll-onb-pulse 1.8s ease-in-out infinite",
        }}
      />
      <span
        style={{
          position: "absolute",
          inset: -3,
          borderRadius: "50%",
          background: "var(--blue)",
          opacity: 0.25,
          animation: "ll-onb-pulse-ring 1.8s ease-in-out infinite",
        }}
      />
    </span>
  );
}

/** Small spinning indicator for the active progress stage. */
function SpinnerDot() {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: 9,
        height: 9,
        borderRadius: "50%",
        border: "2px solid currentColor",
        borderTopColor: "transparent",
        animation: "ll-onb-spin 0.9s linear infinite",
      }}
    />
  );
}

const PULSE_KEYFRAMES = `
@keyframes ll-onb-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(0.85); opacity: 0.6; }
}
@keyframes ll-onb-pulse-ring {
  0% { transform: scale(0.8); opacity: 0.35; }
  100% { transform: scale(1.6); opacity: 0; }
}
@keyframes ll-onb-spin {
  to { transform: rotate(360deg); }
}
`;
