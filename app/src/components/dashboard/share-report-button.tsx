"use client";

import { useState } from "react";
import { Share2, Check, Link as LinkIcon, Trash2 } from "lucide-react";

interface Props {
  vodId: string;
  existingToken?: string | null;
  score?: number;
  /** Optional recommendation pulled from the coach report — used in tweet body. */
  recommendation?: string | null;
  variant?: "compact" | "prominent";
}

const SITE = "https://www.levlcast.com";

/**
 * Score-tier reaction line. Tweets without an angle perform worse than
 * tweets with a reaction the audience can argue with, so the line adapts
 * to the score: high scores get a confident flex, low scores get a
 * self-deprecating "cooked me" angle that bait sympathy/agreement.
 */
function reactionLine(score: number): string {
  if (score >= 85) return "Cooking. Stream's clicking.";
  if (score >= 70) return "Honest read. Going to apply this next stream.";
  if (score >= 55) return "Fair take. Lots to fix but the path is clear.";
  if (score >= 40) return "Tough love but specific. Better than 'just stream more'.";
  return "AI cooked me but at least it was specific. Next stream's going to hit different.";
}

/** Truncate to ~140 chars at a word boundary, no trailing punctuation. */
function trimForTweet(text: string, max = 140): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= max) return collapsed;
  const cut = collapsed.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 60 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:!?\-]$/, "");
}

function buildTweet(url: string, score?: number, recommendation?: string | null): string {
  const lines: string[] = [];
  if (score !== undefined) {
    lines.push(`${score}/100 on my stream coach report.`);
    lines.push("");
    lines.push(reactionLine(score));
  } else {
    lines.push("Got my stream coach report.");
    lines.push("");
    lines.push("Honest AI read on my full VOD.");
  }
  if (recommendation && recommendation.trim().length > 0) {
    lines.push("");
    lines.push(`Biggest takeaway: ${trimForTweet(recommendation, 140)}`);
  }
  lines.push("");
  lines.push("Get yours free:");
  const text = lines.join("\n");
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}

function XIcon({ size = 13 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
}

export function ShareReportButton({ vodId, existingToken, score, recommendation, variant = "compact" }: Props) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState<string | null>(
    existingToken ? `${SITE}/share/${existingToken}` : null
  );
  const [revoking, setRevoking] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch(`/api/vods/${vodId}/share`, { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setUrl(json.url);
        await navigator.clipboard.writeText(json.url);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      }
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  function shareToX() {
    if (!url) return;
    window.open(buildTweet(url, score, recommendation), "_blank", "noopener,noreferrer");
  }

  async function revoke() {
    setRevoking(true);
    try {
      await fetch(`/api/vods/${vodId}/share`, { method: "DELETE" });
      setUrl(null);
    } finally {
      setRevoking(false);
    }
  }

  const isProminent = variant === "prominent";

  // ── Initial state: no token yet ────────────────────────────────────
  if (!url) {
    if (isProminent) {
      return (
        <button
          onClick={generate}
          disabled={loading}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "10px 18px", borderRadius: 10,
            background: "linear-gradient(135deg, var(--blue), var(--green))",
            color: "#fff", fontSize: 13, fontWeight: 700, letterSpacing: "0.01em",
            border: "none", cursor: loading ? "wait" : "pointer",
            opacity: loading ? 0.7 : 1,
            boxShadow: "0 4px 16px -4px color-mix(in oklab, var(--blue) 50%, transparent)",
          }}
        >
          <Share2 size={14} />
          {loading ? "Generating link..." : "Share this report"}
        </button>
      );
    }
    return (
      <button
        onClick={generate}
        disabled={loading}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "10px 18px", borderRadius: 10,
          background: "linear-gradient(135deg, rgb(255,88,0), rgb(242,97,121))",
          color: "#fff", fontSize: 14, fontWeight: 700, letterSpacing: "0.01em",
          border: "none", cursor: loading ? "wait" : "pointer",
          opacity: loading ? 0.7 : 1,
          boxShadow: "0 4px 16px -4px rgba(255,88,0,0.4)",
          transition: "transform 120ms ease",
        }}
        onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
        onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        <Share2 size={15} />
        {loading ? "Generating..." : "Share Report"}
      </button>
    );
  }

  // ── Active state: token exists ─────────────────────────────────────
  if (isProminent) {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <button
          onClick={shareToX}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "9px 16px", borderRadius: 10,
            background: "#000", color: "#fff",
            fontSize: 13, fontWeight: 700,
            border: "1px solid rgba(255,255,255,0.18)", cursor: "pointer",
          }}
        >
          <XIcon size={13} /> Post to X
        </button>
        <button
          onClick={copy}
          style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "9px 14px", borderRadius: 10,
            background: copied ? "color-mix(in oklab, var(--green) 18%, var(--surface-2))" : "var(--surface-2)",
            color: copied ? "var(--green)" : "var(--ink)",
            fontSize: 13, fontWeight: 600,
            border: "1px solid var(--line)", cursor: "pointer",
            transition: "all 150ms",
          }}
        >
          {copied ? <Check size={13} /> : <LinkIcon size={13} />}
          {copied ? "Copied" : "Copy link"}
        </button>
        <button
          onClick={revoke}
          disabled={revoking}
          title="Revoke link"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "9px 12px", borderRadius: 10,
            background: "transparent", color: "var(--ink-3)",
            fontSize: 12, border: "1px solid var(--line)", cursor: "pointer",
            opacity: revoking ? 0.5 : 1,
          }}
        >
          <Trash2 size={12} />
        </button>
      </div>
    );
  }

  // Compact (used on /vods/[id]) — link already exists, copy on click
  return (
    <button
      onClick={copy}
      style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "10px 18px", borderRadius: 10,
        background: copied
          ? "linear-gradient(135deg, #22c55e, #16a34a)"
          : "linear-gradient(135deg, rgb(255,88,0), rgb(242,97,121))",
        color: "#fff", fontSize: 14, fontWeight: 700, letterSpacing: "0.01em",
        border: "none", cursor: "pointer",
        boxShadow: copied
          ? "0 4px 16px -4px rgba(34,197,94,0.4)"
          : "0 4px 16px -4px rgba(255,88,0,0.4)",
        transition: "transform 120ms ease, background 200ms",
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
    >
      {copied ? <Check size={15} /> : <Share2 size={15} />}
      {copied ? "Copied!" : "Share Report"}
    </button>
  );
}
