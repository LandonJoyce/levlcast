import { createClient } from "@/lib/supabase/server";
import { getUserUsage, FREE_LIMITS, PRO_LIMITS } from "@/lib/limits";
import { SubscriptionSection } from "./subscription-section";
import { DeleteAccountSection } from "./delete-account-section";
import { Youtube, Music, CheckCircle, AlertCircle } from "lucide-react";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const params = await searchParams;

  const [{ data: profile }, { data: subscription }, { data: connections }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single(),
    supabase.from("subscriptions").select("status, subscription_expires_at").eq("user_id", user!.id).maybeSingle(),
    supabase.from("social_connections").select("platform").eq("user_id", user!.id),
  ]);

  const usage = await getUserUsage(user!.id, supabase);
  const limits = usage.plan === "pro" ? PRO_LIMITS : FREE_LIMITS;
  const isYouTubeConnected = connections?.some((c) => c.platform === "youtube");

  return (
    <div>
      <div className="mb-8">
        <span className="inline-flex items-center bg-white/[0.04] border border-white/[0.08] text-muted/70 text-[11px] font-medium px-3 py-1 rounded-full mb-3 block w-fit">Your account</span>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-1">Account</h1>
        <p className="text-sm text-muted">Manage your plan and connected accounts.</p>
      </div>

      {(params.success === "youtube") && (
        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 text-sm px-4 py-3 rounded-xl mb-6">
          <CheckCircle size={16} />YouTube connected successfully!
        </div>
      )}
      {params.error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl mb-6">
          <AlertCircle size={16} />
          {params.error === "oauth_failed" ? "Connection failed. Please try again." : "Something went wrong."}
        </div>
      )}

      {/* Profile */}
      <div className="rounded-2xl p-6 mb-4" style={{ background: "rgba(10,9,20,0.98)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-violet-400 mb-4">Profile</p>
        <div className="flex items-center gap-4">
          {profile?.twitch_avatar_url ? (
            <img src={profile.twitch_avatar_url} alt={profile.twitch_display_name} className="w-12 h-12 rounded-full" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-lg font-bold text-accent-light">
              {profile?.twitch_display_name?.[0] || "?"}
            </div>
          )}
          <div>
            <p className="font-bold">{profile?.twitch_display_name || "—"}</p>
            <p className="text-sm text-muted">@{profile?.twitch_login || "—"}</p>
          </div>
        </div>
      </div>

      {/* Subscription */}
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

      {/* Connections */}
      <div className="rounded-2xl p-6 mt-4" style={{ background: "rgba(10,9,20,0.98)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-violet-400 mb-4">Connected Accounts</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center">
                <Youtube size={18} className="text-red-400" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm">YouTube</p>
                <p className="text-xs text-muted">Post clips as YouTube Shorts</p>
              </div>
              {isYouTubeConnected && (
                <span className="text-xs font-semibold text-green-400 bg-green-500/10 px-2 py-1 rounded-full">Connected</span>
              )}
            </div>
            <a href="/api/auth/youtube" className="block w-full text-center bg-red-500 hover:opacity-85 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-opacity">
              {isYouTubeConnected ? "Reconnect YouTube" : "Connect YouTube"}
            </a>
          </div>

          <div className="rounded-xl p-4 opacity-50" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
                <Music size={18} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm">TikTok</p>
                <p className="text-xs text-muted">Auto-post clips to TikTok</p>
              </div>
              <span className="text-xs font-semibold text-muted bg-white/5 px-2 py-1 rounded-full">Soon</span>
            </div>
            <div className="block w-full text-center bg-white/5 text-muted font-semibold px-4 py-2 rounded-xl text-sm cursor-not-allowed">
              Coming Soon
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <DeleteAccountSection />
      </div>
    </div>
  );
}
