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
    <section className="hm-sec ac-delete">
      <div className="ac-row">
        <div>
          <p className="ac-row-main">Delete your account</p>
          <p className="ac-row-sub">
            {confirming
              ? "This deletes your reports, clips, rank and everything else, for good. There's no undo."
              : "Removes your account and everything in it. This can't be undone."}
          </p>
          {error && <p className="ac-err">{error}</p>}
        </div>
        {!confirming ? (
          <button type="button" className="btn btn-ghost ac-danger" onClick={() => setConfirming(true)}>
            Delete account
          </button>
        ) : (
          <div className="ac-delete-act">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setConfirming(false);
                setError(null);
              }}
              disabled={loading}
            >
              Cancel
            </button>
            <button type="button" className="btn ac-danger-solid" onClick={handleDelete} disabled={loading}>
              {loading && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
              {loading ? "Deleting..." : "Yes, delete it"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
