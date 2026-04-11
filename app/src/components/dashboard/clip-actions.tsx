"use client";

import { useState } from "react";
import { Download, Copy, Check, Youtube, Music, ExternalLink, Trash2, RotateCcw } from "lucide-react";
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

export function DownloadClip({ url, title }: { url: string; title: string }) {
  return (
    <a
      href={url}
      download={`${title}.mp4`}
      className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors"
    >
      <Download size={12} />
      Download
    </a>
  );
}

export function DeleteClip({ clipId }: { clipId: string }) {
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

export function PostToTikTok() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted/50 cursor-not-allowed">
      <Music size={12} />
      TikTok — Coming Soon
    </span>
  );
}
