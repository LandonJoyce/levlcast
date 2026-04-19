"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";

export function WrappedShareButton() {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    const text = "Check out my monthly stream Wrapped on LevlCast";
    if (navigator.share) {
      try { await navigator.share({ title: "My LevlCast Wrapped", text, url }); return; } catch {}
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={share}
      className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-full transition-all"
      style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.3)", color: "#a78bfa" }}
    >
      {copied ? <Check size={12} /> : <Share2 size={12} />}
      {copied ? "Copied!" : "Share Wrapped"}
    </button>
  );
}
