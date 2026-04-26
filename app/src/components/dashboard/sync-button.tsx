"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

export function SyncButton() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const router = useRouter();

  async function handleSync() {
    setSyncing(true);
    setResult(null);

    try {
      const res = await fetch("/api/twitch/vods", { method: "POST" });
      const json = await res.json();

      if (!res.ok) {
        setResult(json.error || "Sync failed");
        return;
      }

      if (json.synced === 0) {
        setResult("Already up to date");
      } else {
        setResult(`Synced ${json.synced} new VOD${json.synced > 1 ? "s" : ""}`);
        router.refresh();
      }
    } catch {
      setResult("Network error");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="row gap-md">
      <button
        onClick={handleSync}
        disabled={syncing}
        className="btn btn-blue"
        style={{ opacity: syncing ? 0.6 : 1 }}
      >
        <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
        {syncing ? "Syncing..." : "Sync VODs"}
      </button>
      {result && (
        <span className="mono" style={{ fontSize: 12, color: "var(--ink-3)" }}>{result}</span>
      )}
    </div>
  );
}
