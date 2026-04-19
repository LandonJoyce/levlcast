"use client";

import { useEffect, useState } from "react";
import { X, Sparkles } from "lucide-react";

const KEY = "levlcast_first_score_seen";

export function FirstScoreCelebration({ score }: { score: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(KEY)) setVisible(true);
  }, []);

  function dismiss() {
    localStorage.setItem(KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="rounded-2xl p-5 mb-6 relative overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.14) 0%, rgba(109,40,217,0.06) 100%)", border: "1px solid rgba(139,92,246,0.3)", boxShadow: "0 0 30px rgba(139,92,246,0.08) inset" }}>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.8), transparent)" }} />
      <button
        onClick={dismiss}
        className="absolute top-3 right-3 text-white/25 hover:text-white/60 transition-colors"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center flex-shrink-0" style={{ border: "1px solid rgba(139,92,246,0.25)" }}>
          <Sparkles size={18} className="text-violet-400" />
        </div>
        <div className="pr-6">
          <p className="font-black text-white mb-0.5">Your first coaching score is in.</p>
          <p className="text-sm text-white/50 leading-relaxed">
            You scored <span className="font-bold text-white">{score}/100</span> on your first analyzed stream.
            Analyze more streams to track your progress and climb the ranks.
          </p>
        </div>
      </div>
    </div>
  );
}
