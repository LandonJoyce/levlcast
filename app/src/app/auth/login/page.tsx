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

const HELV = '"Helvetica Neue", "Helvetica", "Arial", system-ui, sans-serif';
const GRAD = "linear-gradient(135deg, rgb(148,61,255) 0%, rgb(242,97,121) 100%)";

const SELLING_POINTS = [
  {
    title: "A coach report on every stream",
    body: "Score, the one thing to fix, growth-killer quotes pulled straight from your VOD.",
  },
  {
    title: "Your best moments, already clipped",
    body: "Hype, comedy, clutch. Captioned and ready to post to YouTube Shorts.",
  },
  {
    title: "Two minutes to rewatch",
    body: "One win, one lesson. We hand you the timestamps so you study your own tape.",
  },
  {
    title: "Connect Twitch once. That's it.",
    body: "Read-only access. We never post to your account. Cancel anytime.",
  },
];

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
    <div style={{ width: "100%", maxWidth: 420 }}>
      {/* Brand */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <Link href="/" style={{
          fontFamily: HELV,
          fontSize: 30, fontWeight: 600, letterSpacing: "-0.02em",
          background: GRAD,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          backgroundClip: "text", textDecoration: "none", display: "inline-block",
        }}>
          LevlCast
        </Link>
      </div>

      {/* Free badge */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
        <span style={{
          fontFamily: HELV,
          fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase",
          padding: "5px 12px", borderRadius: 999,
          background: "rgba(163,230,53,0.12)",
          border: "1px solid rgba(163,230,53,0.3)",
          color: "#A3E635",
        }}>
          Free · No credit card
        </span>
      </div>

      <h1 style={{
        fontFamily: HELV,
        fontSize: 24, fontWeight: 700, color: "#fff", margin: "0 0 8px",
        letterSpacing: "-0.02em", textAlign: "center", lineHeight: 1.2,
      }}>
        Get your first coaching report
      </h1>
      <p style={{
        fontFamily: HELV,
        fontSize: 14, color: "rgba(255,255,255,0.55)",
        margin: "0 0 28px", lineHeight: 1.55, textAlign: "center",
      }}>
        Connect Twitch, sync after a stream, read your report in under 10 minutes.
      </p>

      {showAndroidTip && (
        <div style={{
          marginBottom: 16, padding: "10px 14px", borderRadius: 10,
          fontSize: 13, textAlign: "center",
          background: "rgba(145,70,255,0.08)",
          border: "1px solid rgba(145,70,255,0.25)",
          color: "rgba(255,255,255,0.6)",
          fontFamily: HELV,
        }}>
          On Android, if the Twitch app opens, tap <strong style={{ color: "rgba(255,255,255,0.85)" }}>Cancel</strong> and select your browser to continue.
        </div>
      )}

      {errorMsg && (
        <div style={{
          marginBottom: 16, padding: "10px 14px", borderRadius: 10,
          fontSize: 13, textAlign: "center",
          background: "rgba(248,113,113,0.08)",
          border: "1px solid rgba(248,113,113,0.25)",
          color: "#f87171",
          fontFamily: HELV,
        }}>
          {errorMsg}
        </div>
      )}

      <button
        onClick={handleLogin}
        disabled={loading}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          background: loading ? "rgba(145,70,255,0.5)" : "#9146FF",
          color: "#fff", fontWeight: 700, fontSize: 15, fontFamily: HELV,
          padding: "14px 24px", borderRadius: 12, border: "none",
          cursor: loading ? "not-allowed" : "pointer",
          transition: "background 150ms ease, transform 120ms ease",
          letterSpacing: "0.005em",
        }}
        onMouseDown={(e) => { if (!loading) e.currentTarget.style.transform = "scale(0.98)"; }}
        onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
        </svg>
        {loading ? "Connecting..." : "Continue with Twitch"}
      </button>

      {/* Trust strip */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: 14, marginTop: 16, flexWrap: "wrap",
        fontFamily: HELV,
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          Read-only access
        </span>
        <span style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(255,255,255,0.2)" }} />
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>Cancel anytime</span>
      </div>

      <p style={{
        fontFamily: HELV,
        fontSize: 11.5, color: "rgba(255,255,255,0.3)", textAlign: "center",
        marginTop: 24, lineHeight: 1.6,
      }}>
        By continuing, you agree to our{" "}
        <a href="/terms" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "underline" }}>Terms</a>
        {" "}and{" "}
        <a href="/privacy" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "underline" }}>Privacy Policy</a>.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main style={{
      minHeight: "100vh",
      background: "#08080d",
      fontFamily: HELV,
      color: "#fff",
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
    }} className="login-grid">
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 880px) {
          .login-grid { grid-template-columns: 1fr !important; }
          .login-left { display: none !important; }
        }
      `}</style>

      {/* LEFT — sales/value */}
      <section className="login-left" style={{
        position: "relative",
        background: "linear-gradient(160deg, #0d0a1f 0%, #1a0d2e 50%, #2a0a1f 100%)",
        padding: "56px 56px 48px",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        overflow: "hidden",
      }}>
        {/* gradient aura */}
        <div style={{
          position: "absolute", top: -120, left: -100,
          width: 520, height: 420, borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(148,61,255,0.32) 0%, rgba(242,97,121,0.12) 45%, transparent 70%)",
          filter: "blur(50px)", pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", bottom: -120, right: -120,
          width: 460, height: 380, borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(242,97,121,0.22) 0%, rgba(148,61,255,0.08) 45%, transparent 70%)",
          filter: "blur(60px)", pointerEvents: "none",
        }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <h2 style={{
            fontSize: "clamp(34px, 3.6vw, 48px)",
            fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.05,
            margin: "0 0 20px",
          }}>
            Stop guessing what{" "}
            <span style={{
              background: GRAD,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>killed your stream.</span>
          </h2>

          <p style={{
            fontSize: 16, lineHeight: 1.6, color: "rgba(255,255,255,0.65)",
            margin: "0 0 32px", maxWidth: 460,
          }}>
            LevlCast watches your VOD and tells you exactly what to fix. Score, timestamps, and clips ready to post.
          </p>

          {/* Selling points */}
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px", display: "flex", flexDirection: "column", gap: 18, maxWidth: 480 }}>
            {SELLING_POINTS.map((pt, i) => (
              <li key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <span style={{
                  flexShrink: 0,
                  width: 22, height: 22, borderRadius: 6,
                  background: GRAD,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginTop: 2,
                  boxShadow: "0 4px 12px -4px rgba(148,61,255,0.5)",
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginBottom: 3, letterSpacing: "-0.005em" }}>
                    {pt.title}
                  </div>
                  <div style={{ fontSize: 13.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>
                    {pt.body}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom: trust signals */}
        <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <a
            href="https://apps.apple.com/us/app/levlcast/id6761281566"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "8px 14px", borderRadius: 10,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.85)",
              textDecoration: "none", fontSize: 12,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            Free on the App Store
          </a>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
            Built solo · For streamers, by a streamer
          </span>
        </div>
      </section>

      {/* RIGHT — auth */}
      <section style={{
        background: "#08080d",
        padding: "56px 32px",
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative",
      }}>
        <Suspense fallback={
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 24, height: 24, border: "2px solid rgba(145,70,255,0.5)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          </div>
        }>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
