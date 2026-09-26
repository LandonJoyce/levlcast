"use client";

import { useEffect, useState } from "react";
import { TIERS } from "@/lib/rank";

const STORAGE_KEY = "levlcast_welcome_seen";

/**
 * The first thing a new streamer sees, once. It explains the game they
 * just joined: a placement, then every stream as a ranked game, then a
 * weekly race against streamers near their rank.
 *
 * An early version showed a sample "72/100" score to make this exciting.
 * Real first scores land lower, so it set people up to be disappointed by
 * their own report. The ladder does the exciting part honestly: it shows
 * where they could go, not a number they won't get.
 */

const STEPS = [
  { n: "1", title: "Get placed", body: "Analyze a stream. Your first report puts you on the ladder." },
  { n: "2", title: "Win or learn", body: "Every stream after that is a ranked game. Beat your own recent form and you climb." },
  { n: "3", title: "Race your league", body: "Each week you're up against the streamers nearest your rank." },
];

export default function WelcomeModal({ name }: { name: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      // No storage, no welcome. The page explains itself.
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fs" role="dialog" aria-modal="true" aria-labelledby="wm-title">
      <div className="fs-scrim" onClick={dismiss} />
      <div className="fs-card wm">
        <p className="fs-k">Welcome, {name}</p>
        <h2 id="wm-title" className="fs-title">
          You&apos;re in.
        </h2>
        <ul className="wm-tiers" aria-hidden="true">
          {TIERS.map((t, i) => (
            <li key={t.name} style={{ ["--i" as string]: i }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/ranks/${t.name.toLowerCase()}.png`} alt="" width={384} height={384} />
            </li>
          ))}
        </ul>
        <ol className="wm-steps">
          {STEPS.map((s) => (
            <li key={s.n}>
              <span>{s.n}</span>
              <div>
                <b>{s.title}</b>
                <p>{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <button type="button" className="btn btn-blue wm-go" onClick={dismiss}>
          Let&apos;s go
        </button>
      </div>
    </div>
  );
}
