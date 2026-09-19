/**
 * Public leaderboard.
 *
 * Top 50 only, deliberately. A full listing would publish every user's
 * rank including everyone sitting at the bottom, and none of them signed
 * up to be ranked in public. A cut-off turns the page into something you
 * earn your way onto rather than something done to you.
 *
 * Shown: Twitch display name, avatar, rank. NOT shown: the raw coach
 * score, stream titles, or anything about what was analysed. The rank is
 * a standing; the score is private feedback.
 */

import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/server";
import { rankFromPoints } from "@/lib/rank";
import "./leaderboard.css";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Streamer Leaderboard",
  description:
    "The highest ranked streamers on LevlCast, ranked on how much they improve stream to stream.",
  alternates: { canonical: "/leaderboard" },
};

const TIER_COLOR: Record<string, string> = {
  Iron: "#9AA0A6",
  Bronze: "#C1804B",
  Silver: "#B8C2CC",
  Gold: "#E3B341",
  Platinum: "#4FD1B9",
  Diamond: "#7CC5F5",
  Master: "#C084FC",
  Grandmaster: "#A855F7",
};

interface Row {
  twitch_login: string | null;
  twitch_display_name: string | null;
  twitch_avatar_url: string | null;
  rank_points: number | null;
}

async function topStreamers(): Promise<Row[]> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("profiles")
      .select("twitch_login, twitch_display_name, twitch_avatar_url, rank_points")
      .not("rank_points", "is", null)
      .order("rank_points", { ascending: false })
      .limit(50);
    return (data as Row[] | null) ?? [];
  } catch {
    return [];
  }
}

export default async function LeaderboardPage() {
  const rows = await topStreamers();

  return (
    <main className="lb">
      <header className="lb-head">
        <p className="lb-kicker">LevlCast</p>
        <h1 className="lb-h1">Leaderboard</h1>
        <p className="lb-sub">
          Rank moves on how much a stream improves on the streamer&apos;s own recent
          form, so this is a board of who is getting better fastest, not who is
          already biggest.
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="lb-empty">Nobody has placed yet.</p>
      ) : (
        <ol className="lb-list">
          {rows.map((row, i) => {
            const rank = rankFromPoints(row.rank_points ?? 0);
            const name = row.twitch_display_name || row.twitch_login || "Streamer";
            const color = TIER_COLOR[rank.tier] ?? TIER_COLOR.Iron;
            return (
              <li key={`${row.twitch_login}-${i}`} className="lb-row">
                <span className="lb-pos">{i + 1}</span>

                {row.twitch_avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="lb-avatar" src={row.twitch_avatar_url} alt="" />
                ) : (
                  <span className="lb-avatar lb-avatar-blank" />
                )}

                {row.twitch_login ? (
                  <a
                    className="lb-name"
                    href={`https://twitch.tv/${row.twitch_login}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {name}
                  </a>
                ) : (
                  <span className="lb-name">{name}</span>
                )}

                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="lb-emblem"
                  src={`/ranks/${rank.tier.toLowerCase()}.png`}
                  alt=""
                  aria-hidden="true"
                />
                <span className="lb-tier" style={{ color }}>
                  {rank.label}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <footer className="lb-foot">
        <a href="/analyze">Get ranked. Paste a stream, no account needed.</a>
      </footer>
    </main>
  );
}
