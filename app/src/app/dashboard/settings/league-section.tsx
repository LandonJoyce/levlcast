"use client";

import { useState } from "react";

/**
 * Weekly leagues on or off.
 *
 * Leagues are on by default, so the way out has to be one click and has to
 * say plainly what other streamers can see. The switch reads "on" when the
 * streamer is IN leagues, which is the question a person actually asks.
 */
export function LeagueSection({ optedOut }: { optedOut: boolean }) {
  const [inLeagues, setInLeagues] = useState(!optedOut);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(next: boolean) {
    setSaving(true);
    setError(null);
    setInLeagues(next);
    try {
      const res = await fetch("/api/league/opt-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optOut: !next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setInLeagues(!next);
      setError("Could not save that. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="hm-sec">
      <div className="hm-head">
        <h2>Weekly leagues</h2>
        <span className="hm-record">{inLeagues ? "On" : "Off"}</span>
      </div>
      <div className="ac-row">
        <div>
          <p className="ac-row-main">
            Race the streamers nearest your rank each week. Top three on Monday earn bonus rank points.
          </p>
          <p className="ac-row-sub">
            Your league sees your Twitch name, avatar, rank and points gained this week. Never your coach
            score. Turning this off takes you out of this week&apos;s league right away.
          </p>
          {error && <p className="ac-err">{error}</p>}
        </div>
        <label className="lg-switch">
          <input
            type="checkbox"
            role="switch"
            aria-checked={inLeagues}
            aria-label="Take part in weekly leagues"
            checked={inLeagues}
            disabled={saving}
            onChange={(e) => toggle(e.target.checked)}
          />
          <span className="lg-switch-track" aria-hidden="true" />
        </label>
      </div>
    </section>
  );
}
