"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Twitch, Brain, Zap, X } from "lucide-react";

const STORAGE_KEY = "levlcast_welcome_seen";

const steps = [
  {
    icon: Twitch,
    color: "text-[#9146FF]",
    bg: "bg-[#9146FF]/10",
    title: "Sync your VODs",
    desc: "Connect Twitch and your recent streams import automatically.",
  },
  {
    icon: Brain,
    color: "text-accent-light",
    bg: "bg-accent/10",
    title: "Get managed",
    desc: "Your AI manager coaches every stream, tracks your health, and finds collabs.",
  },
  {
    icon: Zap,
    color: "text-neon",
    bg: "bg-neon/10",
    title: "Grow every week",
    desc: "Weekly game plan, clip generation, and content strategy — all on autopilot.",
  },
];

export default function WelcomeModal({ name }: { name: string }) {
  const [visible, setVisible] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  function handleCTA() {
    dismiss();
    router.push("/dashboard/vods");
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={dismiss}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-surface border border-border rounded-2xl p-8 shadow-2xl">
        {/* Dismiss X */}
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 text-muted hover:text-white transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="mb-6">
          <p className="text-xs font-bold tracking-widest uppercase text-accent-light mb-2">
            Welcome to LevlCast
          </p>
          <h2 className="text-2xl font-extrabold tracking-tight">
            Hey {name}, meet your stream manager.
          </h2>
        </div>

        {/* Steps */}
        <div className="space-y-4 mb-8">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl ${step.bg} flex items-center justify-center flex-shrink-0`}>
                <step.icon size={18} className={step.color} />
              </div>
              <div>
                <p className="font-semibold text-sm">{step.title}</p>
                <p className="text-xs text-muted leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={handleCTA}
          className="w-full bg-accent hover:opacity-90 transition-opacity text-white font-bold py-3.5 rounded-xl text-sm"
        >
          Sync My First VOD →
        </button>

        {/* Dismiss */}
        <button
          onClick={dismiss}
          className="w-full text-center text-xs text-muted hover:text-white transition-colors mt-3 py-1"
        >
          I'll explore on my own
        </button>
      </div>
    </div>
  );
}
