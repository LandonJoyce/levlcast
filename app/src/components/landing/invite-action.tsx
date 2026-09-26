"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Link as LinkIcon } from "lucide-react";

/**
 * The button on a duel or friend-league invite page.
 *
 * Signed in: accept (or join) right here, then go to the dashboard where
 * it shows. Signed out: remember the invite and go sign in with Twitch;
 * the dashboard finishes the accept on the way in (PendingInviteHandler),
 * so a brand-new streamer gets from the link to the duel in one click.
 */

export const PENDING_INVITE_KEY = "levlcast_pending_invite";

export function InviteAction({
  kind,
  code,
  signedIn,
  label,
}: {
  kind: "duel" | "league";
  code: string;
  signedIn: boolean;
  label: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setError(null);
    if (!signedIn) {
      try {
        localStorage.setItem(PENDING_INVITE_KEY, JSON.stringify({ kind, code }));
      } catch {}
      router.push("/auth/login");
      return;
    }
    setBusy(true);
    try {
      const url = kind === "duel" ? `/api/duels/${code}/accept` : `/api/friend-leagues/${code}/join`;
      const res = await fetch(url, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "That didn't work. Try again.");
        return;
      }
      router.push("/dashboard");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="iv-action">
      <button type="button" className="v3-btn" onClick={go} disabled={busy}>
        {busy ? "One sec..." : signedIn ? label : "Sign in with Twitch to accept"}
      </button>
      {error && <p className="iv-error">{error}</p>}
    </div>
  );
}

/** Copy the link you're looking at, for the person who made it. */
export function CopyInvite({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="v3-btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2200);
        } catch {}
      }}
    >
      {copied ? <Check size={15} aria-hidden="true" /> : <LinkIcon size={15} aria-hidden="true" />}
      {copied ? "Copied" : "Copy the link"}
    </button>
  );
}
