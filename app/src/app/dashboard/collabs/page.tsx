import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CollabsList } from "./CollabsList";
import { CollabsInbox } from "./CollabsInbox";
import { CollabSetup } from "./CollabSetup";

/**
 * /dashboard/collabs — the Collab Finder page.
 *
 * Two states, same URL:
 *   - NOT opted in: full-page setup card (Discord field + preferences +
 *     opt-in toggle). The feature's onboarding lives here, not in Settings.
 *   - Opted in: pending-interests inbox + browse list of opted-in streamers.
 *
 * Logic stays minimal — components handle their own state once mounted.
 */

export const dynamic = "force-dynamic";

export default async function CollabsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("collab_opt_in, discord_handle, collab_preferences, plan, founding_member, pro_plus, subscription_expires_at")
    .eq("id", user.id)
    .single();

  const isOptedIn = profile?.collab_opt_in === true;

  // Gate eval — re-checked server-side on every state change too.
  const { count: readyVodCount } = await supabase
    .from("vods")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "ready")
    .not("coach_report", "is", null);
  const hasReadyVod = (readyVodCount ?? 0) >= 1;

  const collabPrefs = (profile?.collab_preferences as { collab_types?: string[] } | null) ?? null;
  const initialCollabTypes = (collabPrefs?.collab_types ?? []).filter(
    (t): t is "co_stream" | "variety_swap" | "podcast" =>
      t === "co_stream" || t === "variety_swap" || t === "podcast"
  );

  if (!isOptedIn) {
    return (
      <>
        <div className="page-head">
          <span className="page-eyebrow">§ 05 · Collabs</span>
          <h1 className="page-title">Collab Finder</h1>
          <p className="page-sub">
            A private pool of streamers open to collabing. Both sides have to accept before any contact info is shared. No cold DMs.
          </p>
        </div>

        <CollabSetup
          initialDiscordHandle={(profile?.discord_handle as string | null) ?? null}
          initialOptIn={false}
          initialCollabTypes={initialCollabTypes}
          hasReadyVod={hasReadyVod}
        />
      </>
    );
  }

  // ─── Opted-in state ──────────────────────────────────────────────────
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [
    { count: sentThisMonth },
    { count: pendingCount },
  ] = await Promise.all([
    supabase
      .from("collab_interests")
      .select("id", { count: "exact", head: true })
      .eq("sender_id", user.id)
      .gte("created_at", monthStart.toISOString()),
    supabase
      .from("collab_interests")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .eq("status", "pending"),
  ]);

  const isExpired =
    profile?.plan === "pro" &&
    profile?.subscription_expires_at &&
    new Date(profile.subscription_expires_at) < new Date();
  const isPaid = profile?.plan === "pro" && !isExpired;
  const sendsLimit = isPaid ? null : 3;

  return (
    <>
      <div className="page-head">
        <span className="page-eyebrow">§ 05 · Collabs</span>
        <h1 className="page-title">Collab Finder</h1>
        <p className="page-sub">
          Other opted-in streamers, sorted by what makes a good collab. Send an interest. If they accept, you both get each other&apos;s Discord.
        </p>
      </div>

      <CollabsInbox initialCount={pendingCount ?? 0} />
      <CollabsList
        sentThisMonth={sentThisMonth ?? 0}
        sendsLimit={sendsLimit}
        isPaid={isPaid}
      />
    </>
  );
}
