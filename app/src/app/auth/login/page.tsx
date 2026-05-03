"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Login page — clean, centered, one-button Twitch OAuth.
 * Matches the dark premium aesthetic of levlcast.com.
 */
const ERROR_MESSAGES: Record<string, string> = {
  no_code: "Something went wrong with the Twitch login. Please try again.",
  auth_failed: "Couldn't connect to Twitch. Please try again.",
  profile_failed: "Account setup failed. Please try again or contact support.",
};

// Build the OAuth URL directly — bypasses the SDK entirely.
// More reliable on mobile (Chrome, Safari, in-app browsers) than
// async SDK calls that can hang or leave a blank screen.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const CALLBACK_URL = "https://levlcast.com/auth/callback";
const TWITCH_OAUTH_URL =
  `${SUPABASE_URL}/auth/v1/authorize` +
  `?provider=twitch` +
  `&redirect_to=${encodeURIComponent(CALLBACK_URL)}` +
  `&scopes=${encodeURIComponent("user:read:email user:read:follows")}`;

function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    const error = searchParams.get("error");
    if (error && ERROR_MESSAGES[error]) {
      setErrorMsg(ERROR_MESSAGES[error]);
    }
  }, [searchParams]);

  return (
    <div className="bg-surface border border-border rounded-2xl p-8">
      <h2 className="text-lg font-bold mb-2">Welcome to LevlCast</h2>
      <p className="text-sm text-muted mb-6">
        Connect your Twitch account to get your first coaching report.
      </p>

      {/* Value bullets */}
      <ul className="space-y-2.5 mb-8">
        {[
          "AI coaching score after every stream",
          "Auto-detect your best clip moments",
          "Post clips to YouTube Shorts in one tap",
        ].map((item) => (
          <li key={item} className="flex items-center gap-2.5 text-sm text-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-light flex-shrink-0" />
            {item}
          </li>
        ))}
      </ul>

      {errorMsg && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 text-center">
          {errorMsg}
        </div>
      )}

      <a
        href={TWITCH_OAUTH_URL}
        onClick={() => setLoading(true)}
        className="w-full flex items-center justify-center gap-3 bg-[#9146FF] hover:bg-[#7B2FE0] text-white font-semibold py-3.5 px-6 rounded-xl transition-all"
        style={{ textDecoration: "none", opacity: loading ? 0.6 : 1 }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
        </svg>
        {loading ? "Connecting..." : "Connect with Twitch"}
      </a>
      <p className="text-xs text-center mt-3" style={{ color: "rgba(255,255,255,0.35)" }}>
        Read-only access. We never post to your account.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-bg flex items-center justify-center px-6">
      {/* Background glow */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] glow-bg pointer-events-none" />

      <div className="relative w-full max-w-sm text-center">
        {/* Logo */}
        <h1 className="text-3xl font-extrabold tracking-tight text-gradient mb-3">
          LevlCast
        </h1>
        <p className="text-muted text-sm mb-12">
          Your AI stream coach.
        </p>

        <Suspense fallback={
          <div className="bg-surface border border-border rounded-2xl p-8">
            <div className="h-48 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-accent-light border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        }>
          <LoginForm />
        </Suspense>

        <p className="text-xs text-muted mt-8">
          By connecting, you agree to our{" "}
          <a href="https://levlcast.com/terms" className="underline hover:text-white transition-colors">Terms of Service</a>
          {" "}and{" "}
          <a href="https://levlcast.com/privacy" className="underline hover:text-white transition-colors">Privacy Policy</a>.
        </p>
      </div>
    </main>
  );
}
