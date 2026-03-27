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
    <div className="flex items-center gap-3">
      <button
        onClick={handleSync}
        disabled={syncing}
        className="inline-flex items-center gap-2 bg-accent hover:opacity-85 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl transition-opacity text-sm"
      >
        <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
        {syncing ? "Syncing..." : "Sync VODs"}
      </button>
      {result && (
        <span className="text-sm text-muted animate-fade-in">{result}</span>
      )}
    </div>
  );
}
