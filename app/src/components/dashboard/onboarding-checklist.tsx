import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

/**
 * Onboarding progress map shown at the top of the dashboard until the
 * user completes the four-step first-stream loop. Each step is a clear
 * next click — sync, analyze, read the report, open in editor.
 *
 * The component returns null once everything is done so the dashboard
 * doesn't keep nagging users who've already completed the loop.
 *
 * Server component: it does its own queries against the user's clips/vods
 * counts so callers don't need to thread state through.
 */
export async function OnboardingChecklist() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Three counts cover the four-step loop.
  // - vodsSynced: are there ANY VODs (synced or not)?
  // - vodsAnalyzed: are there any with status='ready'?
  // - clipsReady: any successful clip generations?
  const [
    { count: vodsSynced },
    { count: vodsAnalyzed },
    { data: firstClip },
  ] = await Promise.all([
    supabase.from("vods").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("vods").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "ready"),
    supabase
      .from("clips")
      .select("id, vod_id")
      .eq("user_id", user.id)
      .eq("status", "ready")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const synced = (vodsSynced ?? 0) > 0;
  const analyzed = (vodsAnalyzed ?? 0) > 0;
  const hasClip = !!firstClip;

  // Hide the panel once all four checks are complete. Twitch is the
  // implicit first step (OAuth gates this whole dashboard) so it's
  // pre-checked on render.
  if (synced && analyzed && hasClip) return null;

  // First incomplete step gets a primary CTA; everything after stays
  // visually disabled so the user knows what's next.
  let activeStep: "sync" | "analyze" | "report" | "edit";
  if (!synced) activeStep = "sync";
  else if (!analyzed) activeStep = "analyze";
  else if (!hasClip) activeStep = "report";
  else activeStep = "edit";

  // First analyzed VOD id — used to deep-link "Read your coach report"
  // straight to that VOD's report page when it's the next step.
  const { data: firstReady } = analyzed
    ? await supabase
        .from("vods")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "ready")
        .order("analyzed_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const steps: Array<{
    key: typeof activeStep;
    title: string;
    description: string;
    href: string;
    cta: string;
    done: boolean;
  }> = [
    {
      key: "sync",
      title: "Sync your VODs from Twitch",
      description: "One click pulls your past broadcasts. No overlay or extra software.",
      href: "/dashboard/vods",
      cta: "Sync now",
      done: synced,
    },
    {
      key: "analyze",
      title: "Run your first analysis",
      description: "Pick any stream, hit Analyze. The full read takes about five minutes.",
      href: "/dashboard/vods",
      cta: "Pick a stream",
      done: analyzed,
    },
    {
      key: "report",
      title: "Read your coach report",
      description: "Score 0–100, the one thing to fix, and the moment worth clipping.",
      href: firstReady ? `/dashboard/vods/${firstReady.id}` : "/dashboard/vods",
      cta: "Open report",
      done: hasClip,
    },
    {
      key: "edit",
      title: "Open your first clip in the editor",
      description: "Trim, fix any caption typos, pick a style, then download or post.",
      href: firstClip ? `/dashboard/clips/${firstClip.id}/edit` : "/dashboard/clips",
      cta: "Open editor",
      done: false,
    },
  ];

  return (
    <div
      className="card bordered accent-blue"
      style={{
        padding: 0,
        overflow: "hidden",
        marginBottom: 24,
      }}
    >
      <div style={{
        padding: "16px 22px",
        borderBottom: "1px solid var(--line)",
        display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16,
      }}>
        <div>
          <p className="mono-label" style={{ color: "var(--blue)", marginBottom: 4 }}>Get started</p>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)", margin: 0, letterSpacing: "-0.01em" }}>
            Finish setup &mdash; takes about 10 minutes total.
          </h2>
        </div>
        <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
          {[true, synced, analyzed, hasClip].filter(Boolean).length} / 4
        </span>
      </div>

      <div>
        {/* Twitch step is always done — keeps the count honest and reassures
            the user that something already worked. */}
        <ChecklistRow
          done
          active={false}
          title="Connected Twitch"
          description="You signed in with Twitch, so we already have your account."
        />
        {steps.map((s) => (
          <ChecklistRow
            key={s.key}
            done={s.done}
            active={!s.done && s.key === activeStep}
            title={s.title}
            description={s.description}
            cta={!s.done && s.key === activeStep ? { href: s.href, label: s.cta } : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function ChecklistRow({
  done,
  active,
  title,
  description,
  cta,
}: {
  done: boolean;
  active: boolean;
  title: string;
  description: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        alignItems: "center",
        gap: 14,
        padding: "14px 22px",
        borderTop: "1px solid var(--line)",
        opacity: done ? 0.55 : active ? 1 : 0.7,
      }}
    >
      {/* Status circle: filled green when done, outlined blue when active, plain when pending. */}
      <span
        aria-hidden
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 22, height: 22, borderRadius: "50%",
          background: done
            ? "var(--green, #A3E635)"
            : active
              ? "color-mix(in oklab, var(--blue) 18%, var(--surface-2))"
              : "var(--surface-2)",
          border: done
            ? "none"
            : active
              ? "2px solid var(--blue)"
              : "2px solid var(--line)",
          color: done ? "#0A0A0F" : active ? "var(--blue)" : "var(--ink-3)",
          fontSize: 11, fontWeight: 800,
        }}
      >
        {done ? "✓" : ""}
      </span>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", margin: 0, lineHeight: 1.35 }}>
          {title}
        </p>
        <p style={{ fontSize: 12.5, color: "var(--ink-3)", margin: "2px 0 0", lineHeight: 1.45 }}>
          {description}
        </p>
      </div>
      <div>
        {cta ? (
          <Link
            href={cta.href}
            className="btn btn-blue"
            style={{ fontSize: 12, padding: "7px 14px", whiteSpace: "nowrap", textDecoration: "none" }}
          >
            {cta.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
