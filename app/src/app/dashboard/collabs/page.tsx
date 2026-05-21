import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CollabsList } from "./CollabsList";
import { CollabsInbox } from "./CollabsInbox";

/**
 * /dashboard/collabs — the Collab Finder page.
 *
 * Layout:
 *   - Inbox row at top (incoming pending interests, if any)
 *   - Forum-style list of opted-in streamers below
 *
 * Gates:
 *   - Must be opted in (Settings → Collab Finder)
 *   - If not opted in, render an empty-state with a CTA pointing at Settings
 */

export const dynamic = "force-dynamic";

export default async function CollabsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("collab_opt_in, discord_handle, plan, founding_member, pro_plus, subscription_expires_at")
    .eq("id", user.id)
    .single();

  const isOptedIn = profile?.collab_opt_in === true;

  // Current monthly send count (calendar month, matches the rest of the app)
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { count: sentThisMonth } = await supabase
    .from("collab_interests")
    .select("id", { count: "exact", head: true })
    .eq("sender_id", user.id)
    .gte("created_at", monthStart.toISOString());

  // Inbox count — pending incoming
  const { count: pendingCount } = await supabase
    .from("collab_interests")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", user.id)
    .eq("status", "pending");

  // Determine effective plan for the send cap (same lapsed-Pro logic as limits.ts)
  const isExpired =
    profile?.plan === "pro" &&
    profile?.subscription_expires_at &&
    new Date(profile.subscription_expires_at) < new Date();
  const isPaid = profile?.plan === "pro" && !isExpired;
  const sendsLimit = isPaid ? null : 3; // null = unlimited

  return (
    <>
      <div className="page-head">
        <span className="page-eyebrow">§ 05 · Collabs</span>
        <h1 className="page-title">Collab Finder</h1>
        <p className="page-sub">
          Other opted-in streamers, sorted by what makes a good collab. Send an interest. If they accept, you both get each other&apos;s Discord.
        </p>
      </div>

      {!isOptedIn ? (
        <div
          className="card card-pad"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            alignItems: "flex-start",
          }}
        >
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em", margin: 0, color: "var(--ink)" }}>
              You haven&apos;t opted in yet
            </h3>
            <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--ink-3)", maxWidth: 520, lineHeight: 1.55 }}>
              The Collab Finder is a private pool of streamers who&apos;ve opted in. Once you&apos;re in, you can browse others and they can find you too. We never share contact info until both sides accept.
            </p>
          </div>
          <Link href="/dashboard/settings" className="btn btn-primary" style={{ padding: "9px 16px", fontSize: 13 }}>
            Set up in Settings
          </Link>
        </div>
      ) : (
        <>
          <CollabsInbox initialCount={pendingCount ?? 0} />
          <CollabsList
            sentThisMonth={sentThisMonth ?? 0}
            sendsLimit={sendsLimit}
            isPaid={isPaid}
          />
        </>
      )}
    </>
  );
}
