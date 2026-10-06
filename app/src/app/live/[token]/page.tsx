import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ownerOfDock } from "@/lib/live/server";
import { shoulders } from "../../fonts";
import LiveDock from "./LiveDock";
import "../live.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "LevlCast Live",
  robots: { index: false, follow: false },
};

/**
 * The private OBS dock. OBS shows this link in a panel only the streamer
 * sees, so it's never part of the stream. The link's token is its only key.
 * See lib/live/server.ts.
 */
export default async function LivePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { token } = await params;
  const owner = await ownerOfDock(token);
  if (!owner) notFound();

  // Hooks for local testing only (a stand-in chat server, faster timers,
  // quicker polling). Production ignores them.
  const sp = await searchParams;
  const dev = process.env.NODE_ENV !== "production";

  return (
    <div className={`ld-root ${shoulders.variable}`}>
      <LiveDock
        token={token}
        channel={owner.login}
        displayName={owner.displayName}
        chatUrl={dev ? sp.irc : undefined}
        speed={dev ? Math.max(1, Number(sp.speed) || 1) : 1}
        pollSeconds={dev ? Math.max(2, Number(sp.poll) || 60) : 60}
      />
    </div>
  );
}
