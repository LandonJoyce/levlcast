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
    <div className="card">
      <div className="card-head">
        <h3>Weekly leagues</h3>
        <span className={`chip ${inLeagues ? "g" : ""}`}>{inLeagues ? "on" : "off"}</span>
      </div>
      <div className="row" style={{ padding: "16px 22px 18px", gap: 18, alignItems: "flex-start" }}>
        <div className="col" style={{ flex: 1, gap: 6 }}>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: "var(--ink)" }}>
            Race the streamers nearest your rank each week. Top three on Monday earn bonus rank points.
          </p>
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: "var(--ink-3)" }}>
            Your league sees your Twitch name, avatar, rank and points gained this week. Never your coach
            score. Turning this off removes you from this week&apos;s league right away.
          </p>
          {error && <p style={{ margin: 0, fontSize: 12.5, color: "var(--danger)" }}>{error}</p>}
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
    </div>
  );
}
