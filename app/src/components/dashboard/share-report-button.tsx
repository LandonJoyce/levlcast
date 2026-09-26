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

export function ShareReportButton({ vodId, existingToken, score, recommendation }: Props) {
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

  // ── No link yet ─────────────────────────────────────────────────
  if (!url) {
    return (
      <button type="button" className="btn btn-ghost" onClick={generate} disabled={loading}>
        <Share2 size={14} aria-hidden="true" />
        {loading ? "Making a link..." : "Share report"}
      </button>
    );
  }

  // ── Link exists: post it, copy it, or turn it off ─────────────────
  return (
    <div className="share-row">
      <button type="button" className="btn btn-ghost" onClick={shareToX}>
        <XIcon size={12} /> Post to X
      </button>
      <button type="button" className="btn btn-ghost" data-done={copied ? "yes" : undefined} onClick={copy}>
        {copied ? <Check size={13} aria-hidden="true" /> : <LinkIcon size={13} aria-hidden="true" />}
        {copied ? "Copied" : "Copy link"}
      </button>
      <button
        type="button"
        className="btn btn-ghost share-off"
        onClick={revoke}
        disabled={revoking}
        title="Turn off this link"
        aria-label="Turn off this link"
      >
        <Trash2 size={13} aria-hidden="true" />
      </button>
    </div>
  );
}
