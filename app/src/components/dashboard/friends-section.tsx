"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Link as LinkIcon, Swords, Users } from "lucide-react";
import { rankFromPoints } from "@/lib/rank";
import type { DuelView } from "@/lib/duels";
import type { FriendLeagueView } from "@/lib/friend-leagues";

/**
 * Duels and your friend league, side by side on the home page.
 *
 * Both run on invite links: a challenge link for a one-week 1v1, and a
 * league link for a private weekly table. The links are how friends who
 * aren't on LevlCast yet end up on it, so copying one is the main action
 * on each side.
 */

interface Props {
  duels: { active: DuelView[]; recent: DuelView[]; openCode: string | null };
  leagues: FriendLeagueView[];
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0";
}

function daysLeft(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.parse(iso) - Date.now();
  if (ms <= 0) return "ending now";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  return d > 0 ? `${d}d ${h}h left` : `${h}h left`;
}

function recordLine(r: DuelView["record"], them: string): string | null {
  const played = r.wins + r.losses + r.draws;
  if (played === 0) return null;
  if (r.wins === r.losses) return `Level ${r.wins}–${r.losses} with ${them}`;
  return r.wins > r.losses ? `You lead ${r.wins}–${r.losses}` : `${them} leads ${r.losses}–${r.wins}`;
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="fr-avatar" src={url} alt="" />
  ) : (
    <span className="fr-avatar fr-avatar-blank">{name.slice(0, 1)}</span>
  );
}

function CopyLink({ url, label = "Copy link" }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost gen-clip"
      data-done={copied ? "yes" : undefined}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2200);
        } catch {}
      }}
    >
      {copied ? <Check size={13} aria-hidden="true" /> : <LinkIcon size={13} aria-hidden="true" />}
      {copied ? "Copied" : label}
    </button>
  );
}

function Duels({ duels }: { duels: Props["duels"] }) {
  const router = useRouter();
  const [code, setCode] = useState<string | null>(duels.openCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const origin = typeof window !== "undefined" ? window.location.origin : "https://levlcast.com";
  const link = code ? `${origin}/duel/${code}` : null;

  async function makeLink() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/duels", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setError(json.error || "Couldn't make a link. Try again.");
      else setCode(json.code);
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!code) return;
    setBusy(true);
    await fetch(`/api/duels/${code}`, { method: "DELETE" }).catch(() => {});
    setCode(null);
    setBusy(false);
    router.refresh();
  }

  const nothing = duels.active.length === 0 && duels.recent.length === 0;

  return (
    <div className="fr-col">
      <div className="fr-head">
        <h3>
          <Swords size={16} strokeWidth={2} aria-hidden="true" /> Duels
        </h3>
        {!link && (
          <button type="button" className="btn btn-blue gen-clip" onClick={makeLink} disabled={busy}>
            {busy ? "Making it..." : "Challenge a friend"}
          </button>
        )}
      </div>

      {link && (
        <div className="fr-link">
          <p className="fr-link-k">Your challenge link</p>
          <p className="fr-link-url">{link.replace(/^https?:\/\//, "")}</p>
          <div className="fr-link-actions">
            <CopyLink url={link} />
            <button type="button" className="fr-quiet" onClick={cancel} disabled={busy}>
              Cancel it
            </button>
          </div>
          <p className="fr-note">Whoever opens it and accepts is your opponent for the next 7 days.</p>
        </div>
      )}

      {nothing && !link && (
        <p className="fr-empty">
          Challenge a streamer friend to a 7-day 1v1. Whoever gains more rank points from their streams wins. They
          don&apos;t need to be on LevlCast yet.
        </p>
      )}

      {duels.active.length > 0 && (
        <ul className="fr-list">
          {duels.active.map((d) => {
            const them = d.them!;
            const lead = d.you.points - them.points;
            const record = recordLine(d.record, them.name);
            return (
              <li key={d.id} className="fr-duel">
                <Avatar url={them.avatarUrl} name={them.name} />
                <div className="fr-duel-main">
                  <p className="fr-duel-name">vs {them.name}</p>
                  <p className="fr-meta">
                    {daysLeft(d.endsAt)}
                    {record ? ` · ${record}` : ""}
                    {d.you.sealed > 0 ? ` · ${d.you.sealed} sealed` : ""}
                  </p>
                </div>
                <div className="fr-score" data-lead={lead > 0 ? "you" : lead < 0 ? "them" : "level"}>
                  <span className="fr-score-you">{signed(d.you.points)}</span>
                  <span className="fr-score-sep">to</span>
                  <span className="fr-score-them">{signed(them.points)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {duels.recent.length > 0 && (
        <ul className="fr-list fr-results">
          {duels.recent.map((d) => (
            <li key={d.id} className="fr-result" data-r={d.result ?? "draw"}>
              <span className="fr-result-k">{d.result === "win" ? "Won" : d.result === "loss" ? "Lost" : "Draw"}</span>
              <span className="fr-result-main">
                vs {d.them?.name} · {signed(d.you.points)} to {signed(d.them?.points ?? 0)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="fr-error">{error}</p>}
    </div>
  );
}

function StartLeague() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/friend-leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setError(json.error || "Couldn't start it. Try again.");
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="fr-start" onSubmit={start}>
      <p className="fr-empty">
        Race your streamer friends every week on rank points gained. Start one, then drop the link in your Discord.
      </p>
      <div className="fr-start-row">
        <input
          className="fr-input"
          value={name}
          maxLength={40}
          placeholder="Name it, like The Night Crew"
          onChange={(e) => setName(e.target.value)}
          aria-label="League name"
        />
        <button type="submit" className="btn btn-blue gen-clip" disabled={busy || !name.trim()}>
          {busy ? "Starting..." : "Start it"}
        </button>
      </div>
      {error && <p className="fr-error">{error}</p>}
    </form>
  );
}

function League({ league }: { league: FriendLeagueView }) {
  const router = useRouter();
  const [showAll, setShowAll] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "https://levlcast.com";
  const rows = showAll ? league.standings : league.standings.slice(0, 6);
  const youHidden = !showAll && league.you && league.you.position > 6;

  async function leave() {
    await fetch(`/api/friend-leagues/${league.id}/leave`, { method: "POST" }).catch(() => {});
    router.refresh();
  }

  return (
    <div className="fr-league">
      <div className="fr-head">
        <h3>
          <Users size={16} strokeWidth={2} aria-hidden="true" /> {league.name}
        </h3>
        <CopyLink url={`${origin}/join/${league.code}`} label="Invite" />
      </div>
      <p className="fr-meta fr-league-sub">
        This week · {league.standings.length} {league.standings.length === 1 ? "streamer" : "streamers"}
        {league.standings.length === 1 ? " so far. Send the invite to your friends." : ""}
      </p>
      <ol className="fr-table">
        {[...rows, ...(youHidden && league.you ? [league.you] : [])].map((s) => {
          const rank = s.rankPoints !== null ? rankFromPoints(s.rankPoints) : null;
          return (
            <li key={s.userId} className="fr-row" data-you={s.isYou ? "yes" : undefined}>
              <span className="fr-pos">{s.position}</span>
              <Avatar url={s.avatarUrl} name={s.name} />
              <span className="fr-name">
                {s.name}
                {s.isYou && <span className="lg-you-chip">You</span>}
              </span>
              {rank && (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="fr-emb" src={`/ranks/${rank.tier.toLowerCase()}.png`} alt={rank.label} title={rank.label} />
              )}
              <span
                className="fr-pts"
                data-sign={s.points > 0 ? "up" : s.points < 0 ? "down" : undefined}
                data-idle={s.streams > 0 ? undefined : "yes"}
              >
                {s.streams > 0 ? signed(s.points) : "Not yet"}
              </span>
            </li>
          );
        })}
      </ol>
      {league.standings.length > 6 && (
        <button type="button" className="fr-quiet" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Show less" : `Show all ${league.standings.length}`}
        </button>
      )}
      {league.sealed > 0 && (
        <p className="fr-note">Your sealed {league.sealed === 1 ? "stream isn't" : "streams aren't"} counted until you open {league.sealed === 1 ? "it" : "them"}.</p>
      )}
      <div className="fr-league-foot">
        {confirmLeave ? (
          <>
            <span>Leave {league.name}?</span>
            <button type="button" className="fr-quiet fr-danger" onClick={leave}>
              Leave
            </button>
            <button type="button" className="fr-quiet" onClick={() => setConfirmLeave(false)}>
              Stay
            </button>
          </>
        ) : (
          <button type="button" className="fr-quiet" onClick={() => setConfirmLeave(true)}>
            Leave league
          </button>
        )}
      </div>
    </div>
  );
}

export function FriendsSection({ duels, leagues }: Props) {
  return (
    <section className="fr" aria-label="Duels and friend leagues">
      <Duels duels={duels} />
      <div className="fr-col">
        {leagues.length === 0 ? (
          <>
            <div className="fr-head">
              <h3>
                <Users size={16} strokeWidth={2} aria-hidden="true" /> Friend league
              </h3>
            </div>
            <StartLeague />
          </>
        ) : (
          leagues.map((l) => <League key={l.id} league={l} />)
        )}
      </div>
    </section>
  );
}
