"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function DeleteAccountSection() {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleDelete() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Not signed in. Please refresh and try again.");
        return;
      }

      const res = await fetch("/api/account/delete", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Error ${res.status}`);
      }

      await supabase.auth.signOut();
      router.push("/");
    } catch (e: any) {
      setError(e?.message || "Could not delete account. Please contact support.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 bg-surface border border-red-500/20 rounded-2xl p-6">
      <h2 className="text-sm font-bold uppercase tracking-wide text-muted mb-1">
        Account Management
      </h2>
      <p className="text-sm text-muted mb-4">
        Permanently delete your account and all associated data. This cannot be undone.
      </p>

      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="text-sm font-semibold text-red-400 hover:text-red-300 transition-colors border border-red-500/30 hover:border-red-400/50 px-4 py-2 rounded-lg"
        >
          Delete Account
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-red-400 font-medium">
            Are you sure? This will permanently delete your account and all your data.
          </p>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-3">
            <button
              onClick={handleDelete}
              disabled={loading}
              className="inline-flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/40 text-red-400 text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading && <Loader2 size={13} className="animate-spin" />}
              {loading ? "Deleting..." : "Yes, delete my account"}
            </button>
            <button
              onClick={() => { setConfirming(false); setError(null); }}
              disabled={loading}
              className="text-sm text-muted hover:text-foreground transition-colors px-4 py-2 rounded-lg border border-border"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
