"use client";

import { useState } from "react";
import { Share2, Check, Link as LinkIcon, Trash2 } from "lucide-react";

interface Props {
  vodId: string;
  existingToken?: string | null;
  score?: number;
  variant?: "compact" | "prominent";
}

const SITE = "https://www.levlcast.com";

function buildTweet(url: string, score?: number): string {
  const text = score !== undefined
    ? `Just got my LevlCast coach report — ${score}/100.\n\nReal coaching from your VOD, not vibes.`
    : `Just got my LevlCast coach report.\n\nReal coaching from your VOD, not vibes.`;
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}

function XIcon({ size = 13 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
}

export function ShareReportButton({ vodId, existingToken, score, variant = "compact" }: Props) {
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
    window.open(buildTweet(url, score), "_blank", "noopener,noreferrer");
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
          background: "linear-gradient(135deg, rgb(148,61,255), rgb(242,97,121))",
          color: "#fff", fontSize: 14, fontWeight: 700, letterSpacing: "0.01em",
          border: "none", cursor: loading ? "wait" : "pointer",
          opacity: loading ? 0.7 : 1,
          boxShadow: "0 4px 16px -4px rgba(148,61,255,0.4)",
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
          : "linear-gradient(135deg, rgb(148,61,255), rgb(242,97,121))",
        color: "#fff", fontSize: 14, fontWeight: 700, letterSpacing: "0.01em",
        border: "none", cursor: "pointer",
        boxShadow: copied
          ? "0 4px 16px -4px rgba(34,197,94,0.4)"
          : "0 4px 16px -4px rgba(148,61,255,0.4)",
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
