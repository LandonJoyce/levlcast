"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { APP_STORE_URL } from "@/components/landing/site-links";

/**
 * The interactive part of the sign-in page: the Twitch button, the error
 * line and the phone tip. Everything else on the page is static.
 */
export default function LoginButton({ error, plan }: { error: string | null; plan: string | null }) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(error);
  const [phone, setPhone] = useState<"ios" | "other" | null>(null);

  useEffect(() => {
    // A "Go Pro" button sends people here with ?plan=. OAuth drops query
    // params on the way back, so the plan waits in localStorage and the
    // dashboard opens Stripe checkout once they're signed in.
    if (plan) {
      try { localStorage.setItem("levlcast_pending_checkout", plan); } catch {}
    }
    // Android hands OAuth links to whichever browser owns them, so the
    // Twitch login can finish somewhere other than where it started. iOS
    // does it less, but sometimes pops Safari or the Twitch app.
    const ua = navigator.userAgent;
    if (/iphone|ipad|ipod/i.test(ua)) setPhone("ios");
    else if (/android|mobile/i.test(ua)) setPhone("other");
  }, [plan]);

  async function signIn() {
    setLoading(true);
    setErrorMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "twitch",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // Only request what we actually read. `user:read:follows` was requested
        // historically but nothing in the codebase ever used it, and every extra
        // scope makes Twitch's consent screen longer and scarier at the exact
        // moment a first-time visitor decides whether to trust us.
        scopes: "user:read:email",
      },
    });
    if (error) {
      setErrorMsg("We couldn't reach Twitch. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="au-action">
      {errorMsg && (
        <p className="au-note au-note-bad" role="alert">
          {errorMsg}
        </p>
      )}
      {phone && (
        <p className="au-note">
          <b>On your phone?</b> Twitch might finish the sign-in in another browser or in the Twitch app. That&apos;s
          normal, and you&apos;ll end up signed in wherever it lands.
          {phone === "ios" && (
            <>
              {" "}The <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer">iPhone app</a> skips all of
              that.
            </>
          )}
        </p>
      )}
      <button type="button" className="au-btn" onClick={signIn} disabled={loading}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
        </svg>
        {loading ? "Opening Twitch…" : "Continue with Twitch"}
      </button>
    </div>
  );
}
