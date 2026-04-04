"use client";

import { useState } from "react";
import { Share2, Check, Link, Trash2 } from "lucide-react";

export function ShareReportButton({ vodId, existingToken }: { vodId: string; existingToken?: string | null }) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState<string | null>(
    existingToken ? `https://www.levlcast.com/share/${existingToken}` : null
  );
  const [revoking, setRevoking] = useState(false);

  async function handleShare() {
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

  async function handleCopy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  async function handleRevoke() {
    setRevoking(true);
    try {
      await fetch(`/api/vods/${vodId}/share`, { method: "DELETE" });
      setUrl(null);
    } finally {
      setRevoking(false);
    }
  }

  if (url) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 bg-accent/10 hover:bg-accent/20 text-accent-light text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
        >
          {copied ? <Check size={12} /> : <Link size={12} />}
          {copied ? "Copied!" : "Copy link"}
        </button>
        <button
          onClick={handleRevoke}
          disabled={revoking}
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-red-400 transition-colors disabled:opacity-50"
          title="Revoke link"
        >
          <Trash2 size={12} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleShare}
      disabled={loading}
      className="inline-flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-muted hover:text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
    >
      <Share2 size={12} />
      {loading ? "Generating..." : "Share Report"}
    </button>
  );
}
