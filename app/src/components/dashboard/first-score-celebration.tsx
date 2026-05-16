"use client";

import { useEffect, useState } from "react";
import { Check, Link as LinkIcon, X } from "lucide-react";

const KEY = "levlcast_first_score_seen";
const SITE = "https://www.levlcast.com";

function scoreColor(score: number): string {
  if (score >= 75) return "#A3E635";
  if (score >= 50) return "#F59E0B";
  return "#F87171";
}

function gasUpLine(score: number): string {
  if (score >= 85) return "You're cooking. Most streamers don't open with this.";
  if (score >= 70) return "Strong first read. The good habits are already there.";
  if (score >= 55) return "Honest start. You've got real moments to build on.";
  if (score >= 40) return "Tough first take, but specific. Most streamers never get this clarity.";
  return "Rough start, but specific. Now you know exactly what to fix.";
}

function reactionLine(score: number): string {
  if (score >= 85) return "Cooking. Stream's clicking.";
  if (score >= 70) return "Honest read. Going to apply this next stream.";
  if (score >= 55) return "Fair take. Lots to fix but the path is clear.";
  if (score >= 40) return "Tough love but specific. Better than 'just stream more'.";
  return "AI cooked me but at least it was specific. Next stream's going to hit different.";
}

function trimForTweet(text: string, max = 140): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= max) return collapsed;
  const cut = collapsed.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 60 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:!?\-]$/, "");
}

function buildTweet(url: string, score: number, recommendation: string | null): string {
  const lines = [
    `${score}/100 on my stream coach report.`,
    "",
    reactionLine(score),
  ];
  if (recommendation && recommendation.trim().length > 0) {
    lines.push("");
    lines.push(`Biggest takeaway: ${trimForTweet(recommendation, 140)}`);
  }
  lines.push("");
  lines.push("Get yours free:");
  const text = lines.join("\n");
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}

function XIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
}

interface Props {
  vodId: string;
  score: number;
  recommendation?: string | null;
  existingToken?: string | null;
}

export function FirstScoreCelebration({ vodId, score, recommendation, existingToken }: Props) {
  const [visible, setVisible] = useState(false);
  const [url, setUrl] = useState<string | null>(
    existingToken ? `${SITE}/share/${existingToken}` : null
  );
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(KEY)) setVisible(true);
  }, []);

  function dismiss() {
    localStorage.setItem(KEY, "1");
    setVisible(false);
  }

  async function ensureLink(): Promise<string | null> {
    if (url) return url;
    setLoading(true);
    try {
      const res = await fetch(`/api/vods/${vodId}/share`, { method: "POST" });
      const json = await res.json();
      if (res.ok && json.url) {
        setUrl(json.url);
        return json.url;
      }
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function shareToX() {
    const link = await ensureLink();
    if (!link) return;
    window.open(buildTweet(link, score, recommendation ?? null), "_blank", "noopener,noreferrer");
  }

  async function copyLink() {
    const link = await ensureLink();
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  if (!visible) return null;

  const color = scoreColor(score);
  const sweepDeg = score * 3.6;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={dismiss} />

      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: "rgba(13,12,18,0.99)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Brand glow accent */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(255,88,0,0.9), transparent)" }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            top: -80, left: "50%", transform: "translateX(-50%)",
            width: 360, height: 220, borderRadius: "50%",
            background: "radial-gradient(ellipse, rgba(255,88,0,0.18) 0%, rgba(242,97,121,0.08) 40%, transparent 70%)",
          }}
        />

        {/* Close */}
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 text-white/30 hover:text-white/70 transition-colors z-10"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>

        <div className="relative px-7 pt-8 pb-7">
          {/* Eyebrow */}
          <div className="text-center mb-5">
            <p
              className="text-[10px] font-extrabold uppercase tracking-widest mb-2"
              style={{ color: "#FF5800" }}
            >
              First report unlocked
            </p>
            <h2 className="text-xl font-black tracking-tight text-white leading-snug">
              Your first coach report is in.
            </h2>
          </div>

          {/* Score circle */}
          <div className="flex justify-center mb-5">
            <div
              style={{
                width: 132, height: 132, borderRadius: "50%",
                background: `conic-gradient(${color} ${sweepDeg}deg, rgba(255,255,255,0.06) 0deg)`,
                padding: 4,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: "100%", height: "100%", borderRadius: "50%",
                  background: "#0d0d12",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                }}
              >
                <span style={{ fontSize: 46, fontWeight: 800, lineHeight: 1, color, letterSpacing: "-0.03em" }}>
                  {score}
                </span>
                <span
                  style={{
                    fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 4,
                    letterSpacing: "0.12em", fontWeight: 700,
                  }}
                >
                  / 100
                </span>
              </div>
            </div>
          </div>

          {/* Gas-up line */}
          <p className="text-center text-[13px] text-white/70 leading-relaxed mb-5 px-2">
            {gasUpLine(score)}
          </p>

          {/* Recommendation pull-quote */}
          {recommendation && (
            <div
              className="rounded-xl px-4 py-3 mb-6"
              style={{
                background: "linear-gradient(135deg, rgba(255,88,0,0.08), rgba(242,97,121,0.04))",
                border: "1px solid rgba(255,88,0,0.22)",
              }}
            >
              <p
                className="text-[10px] font-extrabold uppercase tracking-widest mb-1.5"
                style={{ color: "#FFB08C" }}
              >
                The one thing
              </p>
              <p className="text-[13px] text-white/85 leading-snug">{recommendation}</p>
            </div>
          )}

          {/* Share CTAs */}
          <button
            onClick={shareToX}
            disabled={loading}
            className="w-full text-white font-black py-3.5 rounded-xl text-sm tracking-wide transition-all hover:-translate-y-0.5 active:scale-[0.98] flex items-center justify-center gap-2 mb-2.5"
            style={{
              background: "#000",
              border: "1px solid rgba(255,255,255,0.14)",
              boxShadow: "0 4px 16px -6px rgba(0,0,0,0.6)",
              opacity: loading ? 0.7 : 1,
            }}
          >
            <XIcon size={14} />
            {loading ? "Generating link..." : "Share to X"}
          </button>

          <button
            onClick={copyLink}
            disabled={loading}
            className="w-full font-bold py-3 rounded-xl text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 mb-4"
            style={{
              background: copied
                ? "color-mix(in oklab, #A3E635 18%, rgba(255,255,255,0.04))"
                : "rgba(255,255,255,0.04)",
              color: copied ? "#A3E635" : "rgba(255,255,255,0.85)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {copied ? <Check size={14} /> : <LinkIcon size={14} />}
            {copied ? "Link copied" : "Copy share link"}
          </button>

          <button
            onClick={dismiss}
            className="w-full text-[12px] font-semibold py-2 text-white/40 hover:text-white/70 transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
