"use client";

import { useState } from "react";

/**
 * Emails about your streams, on or off. The switch reads "on" when they
 * get them, like the leagues switch beside it.
 */
export function EmailSection({ optedOut }: { optedOut: boolean }) {
  const [on, setOn] = useState(!optedOut);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(next: boolean) {
    setSaving(true);
    setError(null);
    setOn(next);
    try {
      const res = await fetch("/api/account/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optOut: !next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setOn(!next);
      setError("Could not save that. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="hm-sec">
      <div className="hm-head">
        <h2>Emails</h2>
        <span className="hm-record">{on ? "On" : "Off"}</span>
      </div>
      <div className="ac-row">
        <div>
          <p className="ac-row-main">Get an email when a report or a clip is ready, or you have a new stream to analyze.</p>
          <p className="ac-row-sub">Receipts, payment problems and replies from Landon come through either way.</p>
          {error && <p className="ac-err">{error}</p>}
        </div>
        <label className="lg-switch">
          <input
            type="checkbox"
            role="switch"
            aria-checked={on}
            aria-label="Get emails about my streams"
            checked={on}
            disabled={saving}
            onChange={(e) => toggle(e.target.checked)}
          />
          <span className="lg-switch-track" aria-hidden="true" />
        </label>
      </div>
    </section>
  );
}
