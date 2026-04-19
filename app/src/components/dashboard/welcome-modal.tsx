"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Twitch, Star, Zap } from "lucide-react";

const STORAGE_KEY = "levlcast_welcome_seen";

function ScorePreview() {
  const score = 72;
  const R = 52, cx = 60, cy = 68;
  const startAngle = -200, sweep = 220;
  const polar = (a: number, r = R) => {
    const rad = (a * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const start = polar(startAngle);
  const end = polar(startAngle + sweep);
  const progEnd = polar(startAngle + (score / 100) * sweep);
  const largeArc = sweep > 180 ? 1 : 0;
  const progLarge = (score / 100) * sweep > 180 ? 1 : 0;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 120, height: 87 }}>
        <svg width={120} height={87} viewBox="0 0 120 90" className="absolute inset-0">
          <path
            d={`M ${start.x} ${start.y} A ${R} ${R} 0 ${largeArc} 1 ${end.x} ${end.y}`}
            fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5" strokeLinecap="round"
          />
          <path
            d={`M ${start.x} ${start.y} A ${R} ${R} 0 ${progLarge} 1 ${progEnd.x} ${progEnd.y}`}
            fill="none" stroke="#4ade80" strokeWidth="5" strokeLinecap="round"
            style={{ filter: "drop-shadow(0 0 8px rgba(74,222,128,0.7))" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center" style={{ paddingTop: 6 }}>
          <div className="flex items-baseline gap-0.5">
            <span className="text-3xl font-black text-green-400 tabular-nums">72</span>
            <span className="text-sm font-bold text-white/20">/100</span>
          </div>
        </div>
      </div>
      <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full -mt-1" style={{ background: "rgba(250,204,21,0.08)", border: "1px solid rgba(250,204,21,0.2)", color: "#facc15" }}>
        <Star size={8} fill="currentColor" />Rising Talent
      </span>
      <p className="text-[9px] text-white/25 mt-1.5 font-semibold tracking-wide">example score</p>
    </div>
  );
}

const STEPS = [
  { icon: Twitch, color: "#9146FF", label: "Sync VODs", time: "~30 sec" },
  { icon: Star,   color: "#a78bfa", label: "Get scored", time: "~5 min"  },
  { icon: Zap,    color: "#facc15", label: "Make clips", time: "~1 min"  },
];

export default function WelcomeModal({ name }: { name: string }) {
  const [visible, setVisible] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
    router.push("/dashboard/vods");
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />

      <div className="relative w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl" style={{ background: "rgba(10,9,20,0.99)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-56 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.9), transparent)" }} />

        <div className="px-7 pt-8 pb-7">
          {/* Header */}
          <div className="text-center mb-5">
            <div className="w-2 h-2 rounded-full bg-violet-400 mx-auto mb-3" style={{ boxShadow: "0 0 10px rgba(139,92,246,0.9)" }} />
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-violet-400 mb-2">
              Welcome, {name}
            </p>
            <h2 className="text-xl font-black tracking-tight text-white leading-snug">
              Your streams have a score.
              <br />
              <span className="text-white/45">Let&apos;s find yours.</span>
            </h2>
          </div>

          {/* Score preview */}
          <div className="flex justify-center mb-5">
            <ScorePreview />
          </div>

          {/* 3-step strip */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            {STEPS.map((s, i) => (
              <div
                key={i}
                className="rounded-xl px-2 py-3 text-center"
                style={{ background: `${s.color}0d`, border: `1px solid ${s.color}22` }}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center mx-auto mb-1.5"
                  style={{ background: `${s.color}18` }}
                >
                  <s.icon size={13} style={{ color: s.color }} />
                </div>
                <p className="text-[11px] font-bold text-white leading-tight">{s.label}</p>
                <p className="text-[9px] text-white/30 mt-0.5 font-semibold">{s.time}</p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <button
            onClick={dismiss}
            className="w-full bg-accent text-white font-black py-3.5 rounded-xl text-sm tracking-wide transition-all hover:-translate-y-0.5 hover:shadow-[0_0_28px_rgba(124,58,237,0.5)] active:scale-[0.98]"
          >
            Get My Score →
          </button>
          <button
            onClick={dismiss}
            className="w-full text-center text-[11px] text-white/20 hover:text-white/45 transition-colors mt-2.5 py-1"
          >
            I&apos;ll explore on my own
          </button>
        </div>
      </div>
    </div>
  );
}
