import { createClient } from "@/lib/supabase/server";
import { Settings } from "lucide-react";

/** Settings page — account info and plan */
export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single();

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

      {/* Plan card */}
      <div className="bg-surface border border-border rounded-2xl p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted mb-4">
          Plan
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold capitalize">{profile?.plan || "free"}</p>
            <p className="text-sm text-muted">
              {profile?.plan === "free"
                ? "60 minutes of processing per month"
                : "Upgrade for more processing time"}
            </p>
          </div>
          <button className="bg-accent/10 text-accent-light text-sm font-semibold px-4 py-2 rounded-lg hover:bg-accent/20 transition-colors">
            Upgrade
          </button>
        </div>
      </div>
    </div>
  );
}
