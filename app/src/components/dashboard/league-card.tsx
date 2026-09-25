/**
 * This week's league.
 *
 * The one card on the dashboard about other people. Everything else here
 * is you against your own last stream; this is you against the seven
 * streamers nearest your rank, and the line that matters most is the
 * rival: one name, one gap, one stream to close it.
 *
 * Shows Twitch name, avatar, emblem and weekly points for each member.
 * Never a coach score: the score is private feedback, the league is a
 * standing.
 */

import Link from "next/link";
import { rankFromPoints, TIER_HEX } from "@/lib/rank";
import { PRIZES, type LeagueResult, type LeagueView } from "@/lib/league";
import { ordinal } from "@/lib/utils";

function timeLeft(endsAt: string): string {
  const ms = Date.parse(endsAt) - Date.now();
  if (ms <= 0) return "Ending now";
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(hours / 24);
  if (days >= 1) return `Ends in ${days}d ${hours % 24}h`;
  if (hours >= 1) return `Ends in ${hours}h`;
  return `Ends in ${Math.max(1, Math.floor(ms / 60_000))}m`;
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

function rivalLine(view: LeagueView): string {
  const { you, rival } = view;
  if (you.streams_played === 0) {
    return "Analyze a stream this week to get on the board. Anyone who plays ranks above everyone who doesn't.";
  }
  if (you.position === 1) {
    if (!rival || rival.streams_played === 0) {
      return "You lead. Nobody else in the league has played yet this week.";
    }
    const gap = you.points_gained - rival.points_gained;
    return gap > 0
      ? `You lead. ${rival.name} is ${gap} ${gap === 1 ? "point" : "points"} behind you.`
      : `You lead on the tiebreak. ${rival.name} is level with you on points.`;
  }
  if (!rival) return "";
  const gap = rival.points_gained - you.points_gained;
  if (gap === 0) return `${rival.name} is level with you on points and ahead on the tiebreak. Any win passes them.`;
  return `${rival.name} is ${gap} ${gap === 1 ? "point" : "points"} ahead. One good stream passes them.`;
}

function lastWeekLine(result: LeagueResult): string {
  const place = `${ordinal(result.position)} of ${result.size} in ${result.leagueName}`;
  return result.bonus > 0 ? `Last week: ${place}, +${result.bonus} rank points.` : `Last week: ${place}.`;
}

const Arrow = () => (
  <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
    <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function LeagueCard({
  view,
  lastResult,
}: {
  view: LeagueView | null;
  lastResult: LeagueResult | null;
}) {
  // Not seated this week: nothing analysed in the last four weeks, or new.
  // The card becomes the invitation rather than disappearing, because the
  // league is the reason to analyse the next stream.
  if (!view) {
    return (
      <div className="card card-pad lg-card lg-card-empty">
        <span className="mono-label">Weekly league</span>
        <h3 className="lg-empty-h">Analyze a stream to join this week&apos;s league.</h3>
        <p className="lg-empty-p">
          You&apos;ll race the streamers nearest your rank on points gained this week. Top three on Monday
          earn +{PRIZES[0]}, +{PRIZES[1]} and +{PRIZES[2]} rank points.
        </p>
        {lastResult && <p className="lg-last">{lastWeekLine(lastResult)}</p>}
        <div>
          <Link href="/dashboard/vods" className="btn btn-blue">
            Pick a stream <Arrow />
          </Link>
        </div>
      </div>
    );
  }

  const line = rivalLine(view);

  return (
    <div className="card lg-card">
      <div className="card-head">
        <div className="lg-head">
          <span className="mono-label">Weekly league</span>
          <h3>{view.name}</h3>
        </div>
        <div className="right">
          <span className="label-mono">{timeLeft(view.endsAt)}</span>
        </div>
      </div>

      <div className="lg-rival">
        <span className="lg-you-pos">
          {ordinal(view.you.position)}
          <small> of {view.standings.length}</small>
        </span>
        <div className="lg-rival-copy">
          {line && <p>{line}</p>}
          {view.you.prize > 0 && (
            <p className="lg-prize-note">On course for +{view.you.prize} rank points on Monday.</p>
          )}
        </div>
      </div>

      <ol className="lg-table">
        {view.standings.map((s) => {
          const rank = s.rankPoints !== null ? rankFromPoints(s.rankPoints) : null;
          const played = s.streams_played > 0;
          return (
            <li key={s.user_id} className="lg-row" data-you={s.isYou ? "yes" : undefined} data-played={played ? "yes" : "no"}>
              <span className="lg-pos">{s.position}</span>
              {s.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="lg-avatar" src={s.avatarUrl} alt="" />
              ) : (
                <span className="lg-avatar lg-avatar-blank" />
              )}
              <span className="lg-name">
                {s.login && !s.isYou ? (
                  <a href={`https://twitch.tv/${s.login}`} target="_blank" rel="noopener noreferrer">
                    {s.name}
                  </a>
                ) : (
                  s.name
                )}
                {s.isYou && <span className="lg-you-chip">You</span>}
              </span>
              <span className="lg-tier" style={rank ? { color: TIER_HEX[rank.tier] } : undefined}>
                {rank && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/ranks/${rank.tier.toLowerCase()}.png`} alt="" aria-hidden="true" />
                )}
                <span>{rank?.label ?? "Unranked"}</span>
              </span>
              <span className="lg-streams">
                {played ? `${s.streams_played} ${s.streams_played === 1 ? "stream" : "streams"}` : "not played"}
              </span>
              <span className="lg-points" data-sign={s.points_gained > 0 ? "up" : s.points_gained < 0 ? "down" : "flat"}>
                {played ? signed(s.points_gained) : "..."}
              </span>
              <span className="lg-prize">{s.prize > 0 ? `+${s.prize}` : ""}</span>
            </li>
          );
        })}
      </ol>

      <div className="lg-foot">
        <span>
          Every analyzed stream counts. Top three on Monday earn +{PRIZES[0]}, +{PRIZES[1]}, +{PRIZES[2]} rank points.
        </span>
        {lastResult && <span className="lg-last">{lastWeekLine(lastResult)}</span>}
      </div>
    </div>
  );
}
