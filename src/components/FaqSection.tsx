"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    q: "How long does analysis take?",
    a: "Most VODs are analyzed within 2–5 minutes depending on stream length. We process audio transcription and AI peak detection in parallel so you're not waiting long.",
  },
  {
    q: "Do you store my VODs?",
    a: "No. We stream your VOD directly from Twitch, analyze it, then discard it. Only the transcription data and generated clip files are stored in your account.",
  },
  {
    q: "What about YouTube integration?",
    a: "You can connect your YouTube channel from the dashboard and post clips directly. TikTok and Instagram integrations are coming soon.",
  },
  {
    q: "Is it really free to start?",
    a: "Yes — no credit card required. The free plan includes 1 VOD analysis per month and up to 5 clips total. Upgrade to Pro for unlimited analyses and clips.",
  },
  {
    q: "Does it work with any Twitch streamer?",
    a: "LevlCast works with any Twitch account. Just connect with Twitch OAuth and start analyzing your past VODs immediately.",
  },
  {
    q: "What makes a \"peak moment\"?",
    a: "Our AI detects moments by category: hype (chat spikes, hype trains), funny (laughter, reactions), clutch (key gameplay moments), and educational (insight or tips you drop mid-stream).",
  },
];

export default function FaqSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="py-24 border-t border-border" id="faq">
      <div className="max-w-[680px] mx-auto px-6">
        <p className="text-center text-xs font-bold tracking-[1.5px] uppercase text-accent-light mb-4">
          FAQ
        </p>
        <h2 className="text-4xl md:text-5xl font-extrabold tracking-[-1.5px] text-center mb-14 leading-tight">
          Got questions?
        </h2>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div key={i} className="border border-border rounded-xl overflow-hidden">
              <button
                className="w-full text-left px-6 py-5 flex items-center justify-between gap-4 hover:bg-surface/50 transition-colors"
                onClick={() => setOpen(open === i ? null : i)}
              >
                <span className="font-semibold text-[15px]">{faq.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-muted flex-shrink-0 transition-transform duration-200 ${
                    open === i ? "rotate-180" : ""
                  }`}
                />
              </button>
              {open === i && (
                <div className="px-6 pb-5 text-sm text-muted leading-relaxed border-t border-border pt-4">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
