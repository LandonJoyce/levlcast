"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Tiny "try again" button for failed VOD pages. POSTs to /api/vods/analyze
 * which atomically claims the failed VOD (status: failed -> transcribing)
 * and queues a fresh Inngest event. On success, refreshes the route so the
 * progress UI takes over.
 */
export default function RetryAnalyzeButton({ vodId }: { vodId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/vods/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vodId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Retry failed (${res.status})`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Retry failed");
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={retry}
        disabled={loading}
        className="btn btn-blue"
        style={{ fontSize: 13, padding: "8px 16px", cursor: loading ? "wait" : "pointer" }}
      >
        {loading ? "Queuing..." : "Try Again"}
      </button>
      {error && (
        <span style={{ fontSize: 12, color: "var(--danger)", alignSelf: "center" }}>
          {error}
        </span>
      )}
    </>
  );
}
