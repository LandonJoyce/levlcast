import { createClient } from "@/lib/supabase/server";
import { getUserUsage } from "@/lib/limits";
import { SubscriptionSection } from "./subscription-section";
import { DeleteAccountSection } from "./delete-account-section";
import { LeagueSection } from "./league-section";
import { redirect } from "next/navigation";

/*
 * Everything about the account on one page: who you are, your plan, what's
 * connected, leagues, and deleting it all. Connections used to be a second
 * page that repeated the YouTube row from here; it redirects here now.
 */

const Icons = {
  Twitch: () => (
    <svg viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
      <path d="M4 5l2-3h14v12l-5 5h-4l-3 3H6v-3H2V8l2-3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M11 8v5M16 8v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  YouTube: () => (
    <svg viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
      <rect x="2" y="6" width="20" height="12" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 9l5 3-5 3V9z" fill="currentColor" />
    </svg>
  ),
  TikTok: () => (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z" />
    </svg>
  ),
};

const ERRORS: Record<string, string> = {
  oauth_failed: "That connection didn't go through. Try again.",
  invalid_state: "That connection expired before it finished. Try again.",
  missing_params: "That connection didn't finish. Try again.",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const params = await searchParams;

  const [{ data: profile }, { data: subscription }, { data: connections }, usage] = await Promise.all([
    supabase.from("profiles").select("*, stripe_customer_id, paypal_subscription_id").eq("id", user.id).single(),
    supabase.from("subscriptions").select("status, subscription_expires_at").eq("user_id", user.id).maybeSingle(),
    supabase.from("social_connections").select("platform").eq("user_id", user.id),
    getUserUsage(user.id, supabase),
  ]);

  const has = (p: string) => connections?.some((c) => c.platform === p) ?? false;
  const planLabel = usage.plan === "pro" ? (usage.pro_plus ? "Pro Plus" : "Pro") : "Free";
  const login = (profile?.twitch_login as string | null) ?? null;

  return (
    <>
      <div className="hm-hello">
        <h1 className="page-title">Account</h1>
      </div>

      {(params.success === "youtube" || params.success === "tiktok") && (
        <p className="ac-note" data-tone="good">
          {params.success === "tiktok" ? "TikTok is connected." : "YouTube is connected. Your clips can go out as Shorts now."}
        </p>
      )}
      {params.error && (
        <p className="ac-note" data-tone="bad">
          {ERRORS[params.error] ?? "Something went wrong. Try again."}
        </p>
      )}

      <section className="ac-me">
        {profile?.twitch_avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.twitch_avatar_url} alt="" width={64} height={64} />
        ) : (
          <span className="ac-me-blank">{(profile?.twitch_display_name as string | null)?.slice(0, 1) ?? "?"}</span>
        )}
        <div>
          <p className="ac-me-name">
            {profile?.twitch_display_name || "Streamer"}
            <span className="ac-tag" data-pro={usage.plan === "pro" ? "yes" : undefined}>
              {planLabel}
            </span>
          </p>
          {login && <p className="ac-me-sub">twitch.tv/{login}</p>}
        </div>
      </section>

      <section className="hm-sec">
        <div className="hm-head">
          <h2>Plan</h2>
        </div>
        <SubscriptionSection
          plan={usage.plan}
          proPlus={usage.pro_plus}
          analysesUsed={usage.analyses_used}
          analysesLimit={usage.analyses_limit}
          clipsUsed={usage.clips_used}
          clipsLimit={usage.clips_limit}
          hoursUsed={usage.hours_used}
          hoursLimit={usage.hours_limit}
          periodLabel={usage.period_label}
          onTrial={usage.on_trial}
          hasStripeSubscription={!!profile?.stripe_customer_id}
          hasPaypalSubscription={!!profile?.paypal_subscription_id}
          subscriptionExpiresAt={subscription?.subscription_expires_at ?? profile?.subscription_expires_at ?? null}
          subscriptionStatus={subscription?.status ?? null}
        />
      </section>

      <section className="hm-sec" id="connections">
        <div className="hm-head">
          <h2>Connections</h2>
        </div>
        <ul className="ac-conn">
          <li>
            <span className="ac-conn-icon">
              <Icons.Twitch />
            </span>
            <div>
              <p className="ac-conn-name">Twitch</p>
              <p className="ac-conn-sub">{login ? `twitch.tv/${login} · ` : ""}your streams sync from here</p>
            </div>
            <span className="ac-on">Connected</span>
          </li>
          <li>
            <span className="ac-conn-icon">
              <Icons.YouTube />
            </span>
            <div>
              <p className="ac-conn-name">YouTube</p>
              <p className="ac-conn-sub">Post your clips as Shorts in one click</p>
            </div>
            {has("youtube") ? (
              <div className="ac-conn-act">
                <span className="ac-on">Connected</span>
                <a href="/api/auth/youtube" className="ac-link">
                  Reconnect
                </a>
              </div>
            ) : (
              <a href="/api/auth/youtube" className="btn btn-blue gen-clip">
                Connect
              </a>
            )}
          </li>
          <li>
            <span className="ac-conn-icon">
              <Icons.TikTok />
            </span>
            <div>
              <p className="ac-conn-name">TikTok</p>
              <p className="ac-conn-sub">Posting to TikTok is waiting on TikTok&apos;s approval</p>
            </div>
            {has("tiktok") ? (
              <div className="ac-conn-act">
                <span className="ac-on">Connected</span>
                <a href="/api/auth/tiktok" className="ac-link">
                  Reconnect
                </a>
              </div>
            ) : (
              <a href="/api/auth/tiktok" className="btn btn-ghost gen-clip">
                Connect
              </a>
            )}
          </li>
        </ul>
      </section>

      <LeagueSection optedOut={Boolean(profile?.league_opt_out)} />

      <DeleteAccountSection />
    </>
  );
}
