import { createClient } from "@/lib/supabase/server";
import { getUserUsage, FREE_LIMITS, PRO_LIMITS } from "@/lib/limits";
import { SubscriptionSection } from "./subscription-section";
import { DeleteAccountSection } from "./delete-account-section";

/** Settings page — account info and plan */
export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: subscription }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single(),
    supabase.from("subscriptions").select("status, subscription_expires_at").eq("user_id", user!.id).maybeSingle(),
  ]);

  const usage = await getUserUsage(user!.id, supabase);
  const limits = usage.plan === "pro" ? PRO_LIMITS : FREE_LIMITS;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight mb-1">
          Settings
        </h1>
        <p className="text-sm text-muted">Manage your account and plan.</p>
      </div>

      {/* Account card */}
      <div className="bg-surface border border-border rounded-2xl p-6 mb-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted mb-4">
          Account
        </h2>
        <div className="flex items-center gap-4">
          {profile?.twitch_avatar_url ? (
            <img
              src={profile.twitch_avatar_url}
              alt={profile.twitch_display_name}
              className="w-12 h-12 rounded-full"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-lg font-bold text-accent-light">
              {profile?.twitch_display_name?.[0] || "?"}
            </div>
          )}
          <div>
            <p className="font-bold">
              {profile?.twitch_display_name || "—"}
            </p>
            <p className="text-sm text-muted">
              @{profile?.twitch_login || "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Subscription section (client component for interactivity) */}
      <SubscriptionSection
        plan={usage.plan}
        analysesUsed={usage.analyses_this_month}
        analysesLimit={limits.analyses_per_month}
        clipsUsed={usage.clips_this_month}
        clipsLimit={limits.clips_per_month}
        hasPaypalSubscription={!!profile?.paypal_subscription_id}
        subscriptionExpiresAt={subscription?.subscription_expires_at ?? profile?.subscription_expires_at ?? null}
        subscriptionStatus={subscription?.status ?? null}
      />

      <DeleteAccountSection />
    </div>
  );
}
