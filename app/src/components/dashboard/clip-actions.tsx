"use client";

import React, { useState } from "react";
import { Download, Copy, Check, Youtube, Music, ExternalLink, Trash2, RotateCcw, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

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
        Posted to TikTok
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
        {loading ? "Posting..." : "Post to TikTok"}
      </button>
      {error && <span className="text-xs text-red-400 mt-1">{error}</span>}
    </div>
  );
}
