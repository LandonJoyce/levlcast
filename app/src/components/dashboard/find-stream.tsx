"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The Live panel's "Get my report" opens /dashboard/vods?report=<VOD id>.
 * When that stream isn't synced yet, pull the latest from Twitch once and
 * reload, so it shows up at the top ready to analyze. Twitch can take a
 * few minutes after a stream ends to save the VOD, so a miss says that
 * and offers another look rather than syncing in a loop.
 */
export function FindStream({ twitchVodId }: { twitchVodId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"syncing" | "missing" | "error">("syncing");

  const sync = async () => {
    setState("syncing");
    try {
      sessionStorage.setItem(`lc-find-${twitchVodId}`, String(Date.now()));
    } catch {}
    try {
      const res = await fetch("/api/twitch/vods", { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      router.refresh();
      // Still here after the refresh means Twitch hasn't saved it yet.
      setTimeout(() => setState("missing"), 4000);
    } catch {
      setState("error");
    }
  };

  useEffect(() => {
    let tried = 0;
    try {
      tried = Number(sessionStorage.getItem(`lc-find-${twitchVodId}`) ?? 0);
    } catch {}
    if (Date.now() - tried < 60_000) setState("missing");
    else void sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [twitchVodId]);

  return (
    <section className="sl-focus" aria-live="polite">
      {state === "syncing" ? (
        <p className="sl-focus-t">Getting your stream from Twitch…</p>
      ) : (
        <>
          <p className="sl-focus-t">
            {state === "error" ? "Couldn't reach Twitch just now." : "Twitch is still saving your stream."}
          </p>
          <p className="sl-focus-s">It usually shows up a few minutes after you end. Then you can get your report here.</p>
          <button type="button" className="btn btn-ghost" onClick={() => void sync()}>
            Check again
          </button>
        </>
      )}
    </section>
  );
}
