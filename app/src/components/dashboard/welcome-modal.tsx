"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "levlcast_welcome_seen";

/**
 * First-visit welcome modal shown to new users on the dashboard.
 *
 * Earlier versions showed a fake "72/100 Rising Talent" score preview to
 * make the modal feel exciting. That backfired: real first scores usually
 * land 40-55, so the preview primed users to feel disappointed by their
 * actual report. This version drops the fake score entirely and uses the
 * room to explain the loop honestly.
 *
 * Shows once per browser (localStorage flag) then never again.
 */

const STEPS = [
  {
    n: "1",
    label: "Sync",
    body: "Pull your last VODs from Twitch.",
  },
  {
    n: "2",
    label: "Analyze",
    body: "LevlCast watches the stream and scores every minute.",
  },
  {
    n: "3",
    label: "Improve",
    body: "You get one specific fix for your next stream.",
  },
];

export default function WelcomeModal({ name }: { name: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={dismiss} />

      <div
        className="relative w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "rgba(10,9,20,0.99)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        {/* Top gradient stroke */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-56 h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(255,88,0,0.9), transparent)" }}
        />

        <div className="px-7 pt-8 pb-7">
          {/* Header */}
          <div className="text-center mb-6">
            <div
              className="w-2 h-2 rounded-full mx-auto mb-3"
              style={{ background: "#FF5800", boxShadow: "0 0 10px rgba(255,88,0,0.9)" }}
            />
            <p className="text-[10px] font-extrabold uppercase tracking-widest mb-3" style={{ color: "#FF5800" }}>
              Welcome, {name}
            </p>
            <h2 className="text-2xl font-black tracking-tight text-white leading-tight">
              You&apos;re in.
            </h2>
            <p className="text-sm text-white/55 mt-1.5">
              Here&apos;s the loop you just joined.
            </p>
          </div>

          {/* Loop */}
          <div
            className="rounded-xl overflow-hidden mb-5"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {STEPS.map((s, i) => (
              <div
                key={s.n}
                className="px-4 py-3.5"
                style={{
                  borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div className="flex items-baseline gap-3">
                  <span
                    className="text-[10px] font-extrabold tracking-widest tabular-nums"
                    style={{ color: "#FF5800" }}
                  >
                    {s.n}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-extrabold uppercase tracking-widest text-white/85">
                      {s.label}
                    </p>
                    <p className="text-[12.5px] text-white/55 leading-snug mt-1">
                      {s.body}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Habit anchor — the one line worth memorizing */}
          <div
            className="mb-6 rounded-xl px-4 py-3 text-center"
            style={{
              background: "rgba(255,88,0,0.06)",
              border: "1px solid rgba(255,88,0,0.18)",
            }}
          >
            <p className="text-[12px] text-white/75 leading-relaxed">
              After every stream, sync.{" "}
              <span className="font-bold" style={{ color: "#FFB08C" }}>
                The change between scores is where the coaching lives.
              </span>
            </p>
          </div>

          {/* CTA */}
          <button
            onClick={dismiss}
            className="w-full bg-accent text-white font-black py-3.5 rounded-xl text-sm tracking-wide transition-all hover:-translate-y-0.5 hover:shadow-[0_0_28px_rgba(255,88,0,0.5)] active:scale-[0.98]"
          >
            Open my dashboard →
          </button>
        </div>
      </div>
    </div>
  );
}
