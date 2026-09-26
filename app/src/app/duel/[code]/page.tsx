import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/landing/SiteHeader";
import SiteFooter from "@/components/landing/SiteFooter";
import { InviteAction, CopyInvite } from "@/components/landing/invite-action";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getDuelInvite } from "@/lib/duels";
import { rankFromPoints, TIER_HEX } from "@/lib/rank";
import { shoulders } from "../../fonts";
import "../../home-ranked.css";
import "../../invite.css";

/**
 * A duel invite: levlcast.com/duel/<code>.
 *
 * This is the page a streamer's friend lands on from Discord or a DM, so
 * it's written for someone who has never heard of LevlCast: who's
 * challenging you, what a duel is, and one button.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const invite = await getDuelInvite(createAdminClient(), code).catch(() => null);
  const title = invite ? `${invite.challenger.name} challenged you to a duel` : "Duel on LevlCast";
  return {
    title,
    description: "Seven days, 1v1. Every stream you each analyze counts, and whoever gains more rank points wins.",
    robots: { index: false },
    openGraph: { title, description: "Seven days, 1v1 on LevlCast. Whoever climbs more wins." },
  };
}

function daysLeft(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.parse(iso) - Date.now();
  const d = Math.max(0, Math.ceil(ms / 86_400_000));
  return d === 1 ? "1 day left" : `${d} days left`;
}

export default async function DuelInvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const invite = await getDuelInvite(createAdminClient(), code).catch(() => null);
  const rank = invite?.challenger.rankPoints != null ? rankFromPoints(invite.challenger.rankPoints) : null;
  const isChallenger = !!user && invite?.challenger.id === user.id;

  return (
    <div className={`ll-page v3 ${shoulders.variable}`}>
      <SiteHeader />
      <main className="iv">
        {!invite || invite.status === "cancelled" ? (
          <section className="iv-card">
            <p className="iv-k">Duel</p>
            <h1 className="iv-title">This challenge link doesn&apos;t work anymore.</h1>
            <p className="iv-sub">Whoever sent it may have cancelled it. Ask them for a new one.</p>
            <Link href="/" className="v3-btn">
              What&apos;s LevlCast?
            </Link>
          </section>
        ) : (
          <section className="iv-card">
            <div className="iv-who">
              {invite.challenger.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="iv-avatar" src={invite.challenger.avatarUrl} alt="" />
              ) : (
                <span className="iv-avatar iv-avatar-blank">{invite.challenger.name.slice(0, 1)}</span>
              )}
              {rank && (
                <span className="iv-rank" style={{ color: TIER_HEX[rank.tier] }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/ranks/${rank.tier.toLowerCase()}.png`} alt="" />
                  {rank.label}
                </span>
              )}
            </div>
            <p className="iv-k">1v1 duel</p>

            {invite.status === "open" ? (
              <>
                <h1 className="iv-title">
                  {isChallenger ? "Your challenge link is ready." : `${invite.challenger.name} challenged you to a duel.`}
                </h1>
                <p className="iv-sub">
                  Seven days. Every stream you each analyze on LevlCast counts, and whoever gains more rank points
                  wins. LevlCast is a stream coach that treats every stream like a ranked game.
                </p>
                {isChallenger ? (
                  <>
                    <p className="iv-sub">Send this page to a friend. Whoever accepts first is your opponent.</p>
                    <CopyInvite url={`https://levlcast.com/duel/${invite.code}`} />
                  </>
                ) : (
                  <InviteAction kind="duel" code={invite.code} signedIn={!!user} label="Accept the duel" />
                )}
                <ol className="iv-how">
                  <li>Sign in with Twitch. Free, and your streams come with it.</li>
                  <li>Your first analyzed stream places you on the ladder.</li>
                  <li>Every stream after that scores points in the duel.</li>
                </ol>
              </>
            ) : invite.status === "active" ? (
              <>
                <h1 className="iv-title">
                  {invite.challenger.name} vs {invite.opponent?.name}
                </h1>
                <p className="iv-sub">This duel is on. {daysLeft(invite.endsAt)}.</p>
                {user ? (
                  <Link href="/dashboard" className="v3-btn">
                    See the score
                  </Link>
                ) : (
                  <Link href="/" className="v3-btn">
                    What&apos;s LevlCast?
                  </Link>
                )}
              </>
            ) : (
              <>
                <h1 className="iv-title">
                  {invite.winnerName ? `${invite.winnerName} won this duel.` : "This duel ended in a draw."}
                </h1>
                <p className="iv-sub">
                  {invite.challenger.name} {invite.points.challenger != null ? `(${signed(invite.points.challenger)})` : ""} vs{" "}
                  {invite.opponent?.name} {invite.points.opponent != null ? `(${signed(invite.points.opponent)})` : ""}
                </p>
                <Link href={user ? "/dashboard" : "/"} className="v3-btn">
                  {user ? "Start a rematch" : "What's LevlCast?"}
                </Link>
              </>
            )}
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0";
}
