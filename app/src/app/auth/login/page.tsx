"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

const ERROR_MESSAGES: Record<string, string> = {
  no_code: "Something went wrong with the Twitch login. Please try again.",
  auth_failed: "Couldn't connect to Twitch. Please try again.",
  profile_failed: "Account setup failed. Please try again or contact support.",
};

function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAndroidTip, setShowAndroidTip] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    const error = searchParams.get("error");
    if (error && ERROR_MESSAGES[error]) {
      setErrorMsg(ERROR_MESSAGES[error]);
    }
    if (/android/i.test(navigator.userAgent)) {
      setShowAndroidTip(true);
    }
  }, [searchParams]);

  async function handleLogin() {
    setLoading(true);
    setErrorMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "twitch",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: "user:read:email user:read:follows",
      },
    });
    if (error) {
      setErrorMsg("Couldn't connect to Twitch. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.10)",
      borderRadius: 20,
      padding: "36px 32px",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
    }}>
      {/* Free badge */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase",
          padding: "4px 12px", borderRadius: 999,
          background: "rgba(163,230,53,0.12)",
          border: "1px solid rgba(163,230,53,0.3)",
          color: "#A3E635",
        }}>
          Free to start. No credit card.
        </span>
      </div>

      <h2 style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: "0 0 8px", letterSpacing: "-0.02em", textAlign: "center" }}>
        Get your first coaching report
      </h2>
      <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", margin: "0 0 28px", lineHeight: 1.6, textAlign: "center" }}>
        Connect Twitch, hit Sync after a stream, and read your report in under 10 minutes.
      </p>

      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px", display: "flex", flexDirection: "column", gap: 10 }}>
        {[
          "Coaching score + exact timestamps after every stream",
          "Auto-detect your best clip moments",
          "Post clips to YouTube Shorts in one tap",
        ].map((item) => (
          <li key={item} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "rgba(255,255,255,0.65)" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "linear-gradient(135deg, rgb(148,61,255), rgb(242,97,121))", flexShrink: 0 }} />
            {item}
          </li>
        ))}
      </ul>

      {showAndroidTip && (
        <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 10, fontSize: 13, textAlign: "center", background: "rgba(145,70,255,0.08)", border: "1px solid rgba(145,70,255,0.25)", color: "rgba(255,255,255,0.6)" }}>
          On Android, if the Twitch app opens  -  tap <strong style={{ color: "rgba(255,255,255,0.85)" }}>Cancel</strong> and select your browser to continue.
        </div>
      )}

      {errorMsg && (
        <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 10, fontSize: 13, textAlign: "center", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171" }}>
          {errorMsg}
        </div>
      )}

      <button
        onClick={handleLogin}
        disabled={loading}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          background: loading ? "rgba(145,70,255,0.5)" : "#9146FF",
          color: "#fff", fontWeight: 700, fontSize: 15,
          padding: "14px 24px", borderRadius: 12, border: "none",
          cursor: loading ? "not-allowed" : "pointer",
          transition: "background 150ms ease",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
        </svg>
        {loading ? "Connecting..." : "Connect with Twitch"}
      </button>

      {/* Trust signals  -  prominent */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 14, flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Read-only access
        </span>
        <span style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(255,255,255,0.2)" }} />
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>We never post to your account</span>
        <span style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(255,255,255,0.2)" }} />
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>Cancel anytime</span>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main style={{
      minHeight: "100vh",
      background: "#09091B",
      backgroundImage: `url('/la/sky.png')`,
      backgroundSize: "cover",
      backgroundPosition: "top center",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "24px 20px",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Purple aura  -  matches landing page hero */}
      <div style={{
        position: "absolute", left: "50%", top: "-80px",
        width: "min(1000px, 120vw)", height: 500,
        borderRadius: "50%",
        background: "radial-gradient(ellipse at 50% 0%, rgba(148,61,255,0.38) 0%, rgba(200,70,200,0.14) 40%, rgba(242,97,121,0.06) 65%, transparent 80%)",
        transform: "translateX(-50%)",
        filter: "blur(60px)",
        pointerEvents: "none",
      }} />

      <div style={{ position: "relative", width: "100%", maxWidth: 420 }}>
        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link href="/" style={{
            fontFamily: '"Helvetica Neue", "Helvetica", "Arial", system-ui, sans-serif',
            fontSize: 32, fontWeight: 500, letterSpacing: "-0.01em",
            background: "linear-gradient(135deg, rgb(148,61,255) 0%, rgb(242,97,121) 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            backgroundClip: "text", textDecoration: "none", display: "inline-block",
          }}>
            LevlCast
          </Link>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: "6px 0 0" }}>
            Your AI stream coach
          </p>
        </div>

        <Suspense fallback={
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 20, padding: "48px 32px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 24, height: 24, border: "2px solid rgba(145,70,255,0.5)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          </div>
        }>
          <LoginForm />
        </Suspense>

        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", textAlign: "center", marginTop: 20, lineHeight: 1.6 }}>
          By connecting, you agree to our{" "}
          <a href="/terms" style={{ color: "rgba(255,255,255,0.45)", textDecoration: "underline" }}>Terms</a>
          {" "}and{" "}
          <a href="/privacy" style={{ color: "rgba(255,255,255,0.45)", textDecoration: "underline" }}>Privacy Policy</a>.
        </p>
      </div>
    </main>
  );
}

