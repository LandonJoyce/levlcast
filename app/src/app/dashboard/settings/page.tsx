import { createClient } from "@/lib/supabase/server";
import { getUserUsage } from "@/lib/limits";
import { SubscriptionSection } from "./subscription-section";
import { DeleteAccountSection } from "./delete-account-section";
import { redirect } from "next/navigation";
import Link from "next/link";

const Icons = {
  Twitch: () => (
    <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
      <path d="M4 5l2-3h14v12l-5 5h-4l-3 3H6v-3H2V8l2-3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="M11 8v5M16 8v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  YT: () => (
    <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
      <rect x="2" y="6" width="20" height="12" rx="3" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M10 9l5 3-5 3V9z" fill="currentColor"/>
    </svg>
  ),
  Spark: () => (
    <svg viewBox="0 0 24 24" fill="none" width="12" height="12">
      <path d="M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
    </svg>
  ),
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const params = await searchParams;

  const [{ data: profile }, { data: subscription }, { data: connections }] = await Promise.all([
    supabase.from("profiles").select("*, stripe_customer_id, paypal_subscription_id").eq("id", user.id).single(),
    supabase.from("subscriptions").select("status, subscription_expires_at").eq("user_id", user.id).maybeSingle(),
    supabase.from("social_connections").select("platform").eq("user_id", user.id),
  ]);

  const usage = await getUserUsage(user.id, supabase);
  const isYouTubeConnected = connections?.some((c) => c.platform === "youtube") ?? false;

  return (
    <>
      {/* Header */}
      <div className="page-head">
        <span className="page-eyebrow">§ 04 · Account</span>
        <h1 className="page-title">Account</h1>
        <p className="page-sub">Profile, plan, and connected services.</p>
      </div>

      {/* Success / error banners */}
      {params.success === "youtube" && (
        <div className="card card-pad-sm" style={{ borderColor: "color-mix(in oklab, var(--green) 40%, var(--line))", background: "color-mix(in oklab, var(--green-soft) 30%, var(--surface))" }}>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--green)" }}>YouTube connected successfully.</p>
        </div>
      )}
      {params.error && (
        <div className="card card-pad-sm" style={{ borderColor: "color-mix(in oklab, var(--danger) 40%, var(--line))", background: "color-mix(in oklab, var(--danger-soft) 30%, var(--surface))" }}>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--danger)" }}>
            {params.error === "oauth_failed" ? "Connection failed. Please try again." : "Something went wrong."}
          </p>
        </div>
      )}

      {/* Profile card */}
      <div className="card card-pad">
        <div className="row gap-lg" style={{ alignItems: "flex-start" }}>
          {profile?.twitch_avatar_url ? (
            <img
              src={profile.twitch_avatar_url}
              alt={profile.twitch_display_name}
              style={{ width: 72, height: 72, borderRadius: "50%", flexShrink: 0, border: "1px solid var(--line)", objectFit: "cover" }}
            />
          ) : (
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--grad)", flexShrink: 0 }} />
          )}
          <div className="col" style={{ flex: 1, gap: 6 }}>
            <div className="row gap-sm">
              <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", margin: 0, color: "var(--ink)" }}>
                {profile?.twitch_display_name || "Streamer"}
              </h2>
              <span className={`chip ${usage.plan === "pro" ? "b" : ""}`} style={{ fontFamily: "var(--font-geist-mono), monospace", textTransform: "uppercase", letterSpacing: ".06em", fontSize: 11 }}>
                {usage.plan === "pro" ? "Pro" : "Free"}
              </span>
            </div>
            <span className="mono" style={{ fontSize: 12, color: "var(--ink-3)" }}>
              @{profile?.twitch_login || "?"}{profile?.twitch_login && ` · twitch.tv/${profile.twitch_login}`}
            </span>
          </div>
        </div>
      </div>

      {/* Plan + Connections grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Plan card — wraps existing SubscriptionSection */}
        <div className="card bordered accent-blue">
          <div className="card-head">
            <h3>Plan</h3>
            <span className={`chip ${usage.plan === "pro" ? "b" : ""}`} style={{ fontFamily: "var(--font-geist-mono), monospace", textTransform: "uppercase", letterSpacing: ".06em", fontSize: 11 }}>
              {usage.plan === "pro" ? "PRO" : "FREE"}
            </span>
          </div>
          <div style={{ padding: "18px 22px 22px" }}>
            <SubscriptionSection
              plan={usage.plan}
              analysesUsed={usage.analyses_used}
              analysesLimit={usage.analyses_limit}
              clipsUsed={usage.clips_used}
              clipsLimit={usage.clips_limit}
              periodLabel={usage.period_label}
              onTrial={usage.on_trial}
              hasStripeSubscription={!!profile?.stripe_customer_id}
              hasPaypalSubscription={!!profile?.paypal_subscription_id}
              subscriptionExpiresAt={subscription?.subscription_expires_at ?? profile?.subscription_expires_at ?? null}
              subscriptionStatus={subscription?.status ?? null}
            />
          </div>
        </div>

        {/* Connections card — Twitch + YouTube only */}
        <div className="card">
          <div className="card-head">
            <h3>Connections</h3>
            <span className="label-mono">{1 + (isYouTubeConnected ? 1 : 0)} of 2</span>
          </div>
          <div>
            {/* Twitch — always connected if user logged in */}
            <div className="row" style={{ padding: "14px 22px", borderBottom: "1px solid var(--line)", gap: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--surface-2)", display: "grid", placeItems: "center", color: "var(--magenta)" }}>
                <Icons.Twitch />
              </div>
              <div className="col" style={{ flex: 1, gap: 2 }}>
                <b style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>Twitch</b>
                <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                  twitch.tv/{profile?.twitch_login || "?"} · auto-import on
                </span>
              </div>
              <span className="chip g"><span className="d" /> connected</span>
            </div>

            {/* YouTube — connect/connected */}
            <div className="row" style={{ padding: "14px 22px", gap: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--surface-2)", display: "grid", placeItems: "center", color: "var(--danger)" }}>
                <Icons.YT />
              </div>
              <div className="col" style={{ flex: 1, gap: 2 }}>
                <b style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>YouTube</b>
                <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                  {isYouTubeConnected ? "Publishing Shorts directly from clips" : "Post Smart Clips directly to Shorts"}
                </span>
              </div>
              {isYouTubeConnected ? (
                <span className="chip g"><span className="d" /> connected</span>
              ) : (
                <Link href="/dashboard/connections" className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 12 }}>
                  Connect
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete account — bare, no danger-zone framing */}
      <div style={{ marginTop: 12 }}>
        <DeleteAccountSection />
      </div>
    </>
  );
}
