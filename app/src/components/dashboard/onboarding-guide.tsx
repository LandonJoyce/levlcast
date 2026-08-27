"use client";

import Link from "next/link";
import { CheckCircle2, ArrowRight, Lock } from "lucide-react";

interface Props {
  totalVods: number;
  totalAnalyzed: number;
  totalClips: number;
  latestReadyId: string | null;
}

const STEPS = [
  {
    label: "Sync your Twitch VODs",
    sublabel: "Import your recent streams in about 30 seconds",
    time: "~30 sec",
    href: "/dashboard/vods",
    cta: "Sync VODs",
    doneText: (n: number) => `${n} VOD${n !== 1 ? "s" : ""} synced`,
  },
  {
    label: "Analyze your first stream",
    sublabel: "Get your coaching score, rank, and best clip moments",
    time: "~5 min",
    href: "/dashboard/vods",
    cta: "Pick a VOD",
    doneText: (n: number) => `${n} stream${n !== 1 ? "s" : ""} analyzed`,
  },
  {
    label: "Generate your first clip",
    sublabel: "Turn your best moments into shareable short clips",
    time: "~1 min",
    href: null as string | null,
    cta: "Make a clip",
    doneText: (n: number) => `${n} clip${n !== 1 ? "s" : ""} ready`,
  },
];

export function OnboardingGuide({ totalVods, totalAnalyzed, totalClips, latestReadyId }: Props) {
  const counts = [totalVods, totalAnalyzed, totalClips];
  const statuses = counts.map((c) => c > 0);
  const completedCount = statuses.filter(Boolean).length;
  const progressPct = (completedCount / 3) * 100;
  const activeIdx = statuses.findIndex((s) => !s);

  return (
    <div className="rounded-2xl relative overflow-hidden" style={{ background: "linear-gradient(145deg, rgba(139,92,246,0.1) 0%, rgba(109,40,217,0.04) 60%, rgba(10,9,20,0) 100%)", border: "1px solid rgba(139,92,246,0.22)" }}>
      <div className="absolute top-0 left-0 w-24 h-px" style={{ background: "linear-gradient(90deg, rgba(139,92,246,0.7), transparent)" }} />

      {/* Header + progress bar */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-violet-400">Getting Started</p>
          <span className="text-[10px] font-bold text-white/30">{completedCount} of 3 complete</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${progressPct}%`,
              background: "linear-gradient(90deg, #7c3aed, #a78bfa)",
              boxShadow: "0 0 8px rgba(139,92,246,0.5)",
            }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="px-4 pb-4 space-y-2">
        {STEPS.map((step, i) => {
          const done = statuses[i];
          const active = i === activeIdx;
          const href = i === 2
            ? (latestReadyId ? `/dashboard/vods/${latestReadyId}` : "/dashboard/vods")
            : step.href!;

          if (done) {
            return (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: "rgba(74,222,128,0.04)" }}>
                <CheckCircle2
                  size={16}
                  className="text-green-400 flex-shrink-0"
                  style={{ filter: "drop-shadow(0 0 4px rgba(74,222,128,0.5))" }}
                />
                <p className="text-sm font-semibold text-white/40 line-through flex-1">{step.label}</p>
                <span className="text-[10px] text-green-400/60 font-semibold flex-shrink-0">
                  {step.doneText(counts[i])}
                </span>
              </div>
            );
          }

          if (active) {
            return (
              <div
                key={i}
                className="rounded-xl p-4"
                style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.25)" }}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <div
                        className="w-2 h-2 rounded-full bg-violet-400 flex-shrink-0"
                        style={{ boxShadow: "0 0 6px rgba(139,92,246,0.9)" }}
                      />
                      <p className="text-sm font-black text-white">{step.label}</p>
                    </div>
                    <p className="text-xs text-white/45 leading-relaxed pl-4">{step.sublabel}</p>
                  </div>
                  <span className="text-[10px] font-bold text-white/30 flex-shrink-0 bg-white/[0.04] px-2 py-1 rounded-lg border border-white/[0.06] mt-0.5">
                    {step.time}
                  </span>
                </div>
                <Link
                  href={href}
                  className="inline-flex items-center gap-1.5 bg-accent text-white text-xs font-bold px-4 py-2 rounded-lg transition-all hover:-translate-y-px hover:shadow-[0_0_16px_rgba(124,58,237,0.4)] active:scale-[0.97]"
                >
                  {step.cta} <ArrowRight size={11} />
                </Link>
              </div>
            );
          }

          // Locked future step
          return (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl opacity-35">
              <Lock size={14} className="text-white/30 flex-shrink-0" />
              <p className="text-sm font-semibold text-white/50 flex-1">{step.label}</p>
              <span className="text-[10px] text-white/20 font-semibold flex-shrink-0">{step.time}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
