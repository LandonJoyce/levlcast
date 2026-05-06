"use client";

import React, { useState } from "react";
import { Download, Copy, Check, Youtube, Music, ExternalLink, Trash2, RotateCcw, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { CaptionStyle } from "@/lib/captions";

const CAPTION_STYLES: {
  value: CaptionStyle;
  label: string;
  tag?: string;
  bg: string;
  render: () => React.ReactNode;
}[] = [
  {
    value: "bold", label: "Bold", tag: "Popular", bg: "#0e0e0e",
    render: () => <span style={{ fontWeight: 900, fontSize: 17, color: "#fff", textTransform: "uppercase", textShadow: "-3px -3px 0 #000,3px -3px 0 #000,-3px 3px 0 #000,3px 3px 0 #000", letterSpacing: ".03em", lineHeight: 1.1 }}>CAPTION</span>,
  },
  {
    value: "classic", label: "Classic", bg: "#0e0e0e",
    render: () => <span style={{ fontWeight: 900, fontSize: 17, color: "#FFE600", textTransform: "uppercase", textShadow: "-3px -3px 0 #000,3px -3px 0 #000,-3px 3px 0 #000,3px 3px 0 #000", letterSpacing: ".03em" }}>CAPTION</span>,
  },
  {
    value: "fire", label: "Fire", bg: "#0e0e0e",
    render: () => <span style={{ fontWeight: 900, fontSize: 17, color: "#FF6B00", textTransform: "uppercase", textShadow: "-3px -3px 0 #1A0000,3px -3px 0 #1A0000,-3px 3px 0 #1A0000,3px 3px 0 #1A0000,0 0 12px rgba(255,107,0,0.4)", letterSpacing: ".03em" }}>CAPTION</span>,
  },
  {
    value: "neon", label: "Neon", bg: "#050f11",
    render: () => <span style={{ fontWeight: 900, fontSize: 17, color: "#00EEFF", textTransform: "uppercase", textShadow: "-2px -2px 0 #003344,2px -2px 0 #003344,-2px 2px 0 #003344,2px 2px 0 #003344,0 0 14px rgba(0,238,255,0.45)", letterSpacing: ".03em" }}>CAPTION</span>,
  },
  {
    value: "impact", label: "Impact", bg: "#0e0e0e",
    render: () => <span style={{ fontWeight: 900, fontSize: 21, color: "#fff", textTransform: "uppercase", textShadow: "-4px -4px 0 #000,4px -4px 0 #000,-4px 4px 0 #000,4px 4px 0 #000", letterSpacing: "-.01em", lineHeight: 1 }}>CAPTION</span>,
  },
  {
    value: "boxed", label: "Boxed", bg: "#0e0e0e",
    render: () => <span style={{ fontWeight: 700, fontSize: 14, color: "#fff", textTransform: "uppercase", background: "rgba(0,0,0,0.6)", padding: "4px 10px", borderRadius: 5, letterSpacing: ".02em" }}>CAPTION</span>,
  },
  {
    value: "minimal", label: "Minimal", bg: "#0e0e0e",
    render: () => <span style={{ fontWeight: 500, fontSize: 13, color: "rgba(255,255,255,0.92)", textShadow: "-1px -1px 0 rgba(0,0,0,0.8),1px 1px 0 rgba(0,0,0,0.8)" }}>Caption text</span>,
  },
];

export function CopyCaption({ caption }: { caption: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(caption);
    } catch {
      // Fallback for HTTP or permission denied
      const el = document.createElement("textarea");
      el.value = caption;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Copied" : "Copy caption"}
    </button>
  );
}

export function DownloadClip({ clipId }: { clipId: string; url?: string; title?: string }) {
  // Route through our API so the browser honors Content-Disposition: attachment.
  // A direct <a href={R2_URL} download> does NOT trigger a download for
  // cross-origin URLs — browsers ignore the download attribute and just open
  // the video in a new tab.
  return (
    <a
      href={`/api/clips/${clipId}/download`}
      className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors"
    >
      <Download size={12} />
      Download
    </a>
  );
}

export function DeleteClip({ clipId, onDeleted }: { clipId: string; onDeleted?: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleDelete() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clips/${clipId}`, { method: "DELETE" });
      if (!res.ok) {
        setError("Delete failed. Try again.");
        setConfirming(false);
        return;
      }
      // Optimistically hide the card immediately before router.refresh() resolves
      onDeleted?.();
      setConfirming(false);
      router.refresh();
    } catch {
      setError("Network error.");
      setConfirming(false);
    } finally {
      setLoading(false);
    }
  }

  if (confirming) {
    return (
      <div className="inline-flex items-center gap-2">
        <span className="text-xs text-muted">Delete?</span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
        >
          {loading ? "..." : "Yes"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs text-muted hover:text-white transition-colors"
        >
          No
        </button>
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col">
      <button
        onClick={() => { setConfirming(true); setError(null); }}
        className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-red-400 transition-colors"
      >
        <Trash2 size={12} />
        Delete
      </button>
      {error && <span className="text-xs text-red-400 mt-0.5">{error}</span>}
    </div>
  );
}

/** Wraps a clip card so the whole card can be hidden optimistically on delete. */
export function ClipCardWrapper({ clipId, children }: { clipId: string; children: (onDeleted: () => void) => React.ReactNode }) {
  const [deleted, setDeleted] = useState(false);
  if (deleted) return null;
  return <>{children(() => setDeleted(true))}</>;
}

/**
 * One-tap regenerate: soft-deletes the current clip then immediately queues
 * a new generation for the same peak. Used on clips that are audio-only or broken.
 */
export function RegenerateClip({ clipId, vodId, startSeconds, onRegenerated }: { clipId: string; vodId: string; startSeconds: number; onRegenerated?: () => void }) {
  const [state, setState] = useState<"idle" | "loading" | "queued" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleRegenerate() {
    setState("loading");
    setError(null);
    try {
      // Step 1: soft-delete the old clip
      const delRes = await fetch(`/api/clips/${clipId}`, { method: "DELETE" });
      if (!delRes.ok) throw new Error("Delete failed");

      // Step 2: queue new generation for the same peak
      const genRes = await fetch("/api/clips/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vodId, startSeconds }),
      });
      const json = await genRes.json();
      if (!genRes.ok) throw new Error(json.error || "Generate failed");

      setState("queued");
      onRegenerated?.();
      router.refresh();
    } catch (e: any) {
      setError(e.message || "Something went wrong");
      setState("error");
    }
  }

  if (state === "queued") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-accent-light font-medium">
        <Loader2 size={12} className="animate-spin" />
        Regenerating...
      </span>
    );
  }

  return (
    <div className="inline-flex flex-col gap-0.5">
      <button
        onClick={handleRegenerate}
        disabled={state === "loading"}
        className="inline-flex items-center gap-1.5 text-xs text-yellow-400 hover:text-yellow-300 transition-colors disabled:opacity-50"
      >
        <RotateCcw size={12} className={state === "loading" ? "animate-spin" : ""} />
        {state === "loading" ? "Regenerating..." : "Regenerate"}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}

export function PostToYouTube({
  clipId,
  isConnected,
  existingUrl,
}: {
  clipId: string;
  isConnected: boolean;
  existingUrl?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(existingUrl || null);
  const [error, setError] = useState<string | null>(null);
  const [reposting, setReposting] = useState(false);

  if (!isConnected) {
    return (
      <a
        href="/dashboard/connections"
        className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors"
      >
        <Youtube size={12} />
        Connect YouTube
      </a>
    );
  }

  if (url && !reposting) {
    return (
      <div className="inline-flex items-center gap-2">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 transition-colors"
        >
          <ExternalLink size={12} />
          View on YouTube
        </a>
        <button
          onClick={() => setReposting(true)}
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-white transition-colors"
        >
          <RotateCcw size={11} />
          Re-post
        </button>
      </div>
    );
  }

  async function handlePost() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/youtube/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clipId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setUrl(data.url);
      setReposting(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex flex-col">
      <div className="inline-flex items-center gap-2">
        <button
          onClick={handlePost}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
        >
          <Youtube size={12} />
          {loading ? "Uploading..." : "Post to YouTube"}
        </button>
        {reposting && (
          <button onClick={() => setReposting(false)} className="text-xs text-muted hover:text-white transition-colors">
            Cancel
          </button>
        )}
      </div>
      {error && <span className="text-xs text-red-400 mt-1">{error}</span>}
    </div>
  );
}

export function ChangeStyleButton({
  clipId,
  vodId,
  peakIndex,
  currentStyle = "bold",
}: {
  clipId: string;
  vodId: string;
  peakIndex: number;
  currentStyle?: CaptionStyle;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [style, setStyle] = useState<CaptionStyle>(currentStyle);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleApply() {
    setLoading(true);
    setError(null);
    setModalOpen(false);
    try {
      const delRes = await fetch(`/api/clips/${clipId}`, { method: "DELETE" });
      if (!delRes.ok) throw new Error("Failed to remove old clip");

      const genRes = await fetch("/api/clips/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vodId, peakIndex, captionStyle: style }),
      });
      const json = await genRes.json();
      if (!genRes.ok) throw new Error(json.message || json.error || "Generate failed");

      setDone(true);
      router.refresh();
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return <span style={{ fontSize: 12, color: "var(--blue)" }}>Regenerating with new style...</span>;
  }

  const selectedStyle = CAPTION_STYLES.find((s) => s.value === style) ?? CAPTION_STYLES[0];

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        disabled={loading}
        style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: 12, color: "var(--ink-3)", padding: 0,
          display: "inline-flex", alignItems: "center", gap: 5,
        }}
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
        {loading ? "Regenerating..." : "Change style"}
      </button>

      {error && <span style={{ fontSize: 11, color: "var(--danger)", marginLeft: 6 }}>{error}</span>}

      {modalOpen && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}
        >
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 16, width: "100%", maxWidth: 480, boxShadow: "0 24px 64px rgba(0,0,0,0.6)", overflow: "hidden" }}>
            <div style={{ padding: "20px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ margin: 0, fontSize: 11, color: "var(--ink-3)", letterSpacing: ".08em", textTransform: "uppercase", fontFamily: "var(--font-geist-mono), monospace" }}>Change Caption Style</p>
              <button onClick={() => setModalOpen(false)} style={{ background: "none", border: "none", color: "var(--ink-3)", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: 4 }}>×</button>
            </div>

            <div style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {CAPTION_STYLES.map((s) => {
                const selected = style === s.value;
                return (
                  <button
                    key={s.value}
                    onClick={() => setStyle(s.value)}
                    style={{
                      background: selected ? "color-mix(in oklab, var(--blue) 10%, var(--surface-2))" : "var(--surface-2)",
                      border: selected ? "2px solid var(--blue)" : "2px solid var(--line)",
                      borderRadius: 10, padding: 0, cursor: "pointer", overflow: "hidden",
                      display: "flex", flexDirection: "column", position: "relative", transition: "border-color 0.12s",
                    }}
                  >
                    {s.tag && (
                      <span style={{ position: "absolute", top: 5, right: 5, zIndex: 1, fontSize: 8, fontWeight: 700, letterSpacing: ".06em", color: "#fff", background: "var(--blue)", padding: "2px 5px", borderRadius: 4, textTransform: "uppercase" }}>{s.tag}</span>
                    )}
                    <div style={{ background: s.bg, height: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 8px", textAlign: "center" }}>
                      {s.render()}
                    </div>
                    <div style={{ padding: "6px 4px", fontSize: 10, fontWeight: selected ? 700 : 500, color: selected ? "var(--blue)" : "var(--ink-3)", letterSpacing: ".04em", textAlign: "center", background: "var(--surface-2)" }}>
                      {s.label}
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ background: "#111", borderRadius: 10, height: 56, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--line)" }}>
                {selectedStyle.render()}
              </div>
              <button onClick={handleApply} className="btn btn-blue" style={{ width: "100%", justifyContent: "center", fontSize: 13, padding: "11px 0" }}>
                Apply {selectedStyle.label}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function PostToTikTok({
  clipId,
  isConnected,
  alreadyPosted,
}: {
  clipId: string;
  isConnected: boolean;
  alreadyPosted?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [posted, setPosted] = useState(alreadyPosted ?? false);
  const [error, setError] = useState<string | null>(null);

  // TikTok Content Posting API audit pending — show coming soon until approved
  return (
    <span className="inline-flex items-center gap-1.5 text-xs opacity-35 cursor-not-allowed select-none">
      <Music size={12} />
      TikTok coming soon
    </span>
  );

  if (!isConnected) {
    return (
      <a
        href="/dashboard/connections"
        className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors"
      >
        <Music size={12} />
        Connect TikTok
      </a>
    );
  }

  if (posted) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-green-400">
        <Check size={12} />
        Saved to TikTok drafts
      </span>
    );
  }

  async function handlePost() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tiktok/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clipId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setPosted(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex flex-col">
      <button
        onClick={handlePost}
        disabled={loading}
        className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors disabled:opacity-50"
      >
        <Music size={12} />
        {loading ? "Posting..." : "Save to TikTok drafts"}
      </button>
      {error && <span className="text-xs text-red-400 mt-1">{error}</span>}
    </div>
  );
}
