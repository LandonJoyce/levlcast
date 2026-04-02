"use client";

import { useState } from "react";
import { Download, Copy, Check, Youtube, ExternalLink } from "lucide-react";

export function CopyCaption({ caption }: { caption: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(caption);
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

  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 transition-colors"
      >
        <ExternalLink size={12} />
        View on YouTube
      </a>
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
        className="inline-flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
      >
        <Youtube size={12} />
        {loading ? "Uploading..." : "Post to YouTube"}
      </button>
      {error && <span className="text-xs text-red-400 mt-1">{error}</span>}
    </div>
  );
}
