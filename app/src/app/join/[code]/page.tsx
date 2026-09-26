import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/landing/SiteHeader";
import SiteFooter from "@/components/landing/SiteFooter";
import { InviteAction, CopyInvite } from "@/components/landing/invite-action";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getFriendLeagueInvite } from "@/lib/friend-leagues";
import { rankFromPoints } from "@/lib/rank";
import { shoulders } from "../../fonts";
import "../../home-ranked.css";
import "../../invite.css";

/**
 * A friend-league invite: levlcast.com/join/<code>. Usually dropped in a
 * Discord, so it says whose league it is, who's already in, and what
 * joining means, for someone who's never heard of LevlCast.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const invite = await getFriendLeagueInvite(createAdminClient(), code).catch(() => null);
  const title = invite ? `Join ${invite.name} on LevlCast` : "Friend league on LevlCast";
  return {
    title,
    description: "A private weekly race with your streamer friends. Every stream you analyze scores rank points.",
    robots: { index: false },
    openGraph: { title, description: "A private weekly race with your streamer friends on LevlCast." },
  };
}

export default async function JoinLeaguePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const invite = await getFriendLeagueInvite(createAdminClient(), code).catch(() => null);
  const already = !!user && !!invite?.members.some((m) => m.id === user.id);

  return (
    <div className={`ll-page v3 ${shoulders.variable}`}>
      <SiteHeader />
      <main className="iv">
        {!invite ? (
          <section className="iv-card">
            <p className="iv-k">Friend league</p>
            <h1 className="iv-title">This invite link doesn&apos;t work anymore.</h1>
            <p className="iv-sub">The league may have closed. Ask whoever sent it for a new link.</p>
            <Link href="/" className="v3-btn">
              What&apos;s LevlCast?
            </Link>
          </section>
        ) : (
          <section className="iv-card">
            <ul className="iv-faces" aria-label="Already in">
              {invite.members.map((m) => {
                const rank = m.rankPoints != null ? rankFromPoints(m.rankPoints) : null;
                return (
                  <li key={m.id} title={rank ? `${m.name} · ${rank.label}` : m.name}>
                    {m.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="iv-face" src={m.avatarUrl} alt="" />
                    ) : (
                      <span className="iv-face iv-avatar-blank">{m.name.slice(0, 1)}</span>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="iv-k">Friend league</p>
            <h1 className="iv-title">{already ? `You're in ${invite.name}.` : `Join ${invite.name}.`}</h1>
            <p className="iv-sub">
              {invite.ownerName}&apos;s private league, {invite.memberCount} {invite.memberCount === 1 ? "streamer" : "streamers"} so
              far. Every week it ranks you on rank points gained from the streams you analyze on LevlCast, the stream
              coach that treats every stream like a ranked game.
            </p>
            {already ? (
              <>
                <p className="iv-sub">Send this link to more friends to fill it up.</p>
                <CopyInvite url={`https://levlcast.com/join/${invite.code}`} />
              </>
            ) : (
              <InviteAction kind="league" code={invite.code} signedIn={!!user} label={`Join ${invite.name}`} />
            )}
            <ol className="iv-how">
              <li>Sign in with Twitch. Free, and your streams come with it.</li>
              <li>Your first analyzed stream places you on the ladder.</li>
              <li>Every stream after that counts in the weekly table.</li>
            </ol>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
