"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

/**
 * Login page — clean, centered, one-button Twitch OAuth.
 * Matches the dark premium aesthetic of levlcast.com.
 */
export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "twitch",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: "user:read:email user:read:follows",
      },
    });

    if (error) {
      console.error("Login failed:", error.message);
      setLoading(false);
    }
  }

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
          Your personal streaming manager.
        </p>

        {/* Twitch login card */}
        <div className="bg-surface border border-border rounded-2xl p-8">
          <h2 className="text-lg font-bold mb-2">Welcome to LevlCast</h2>
          <p className="text-sm text-muted mb-6">
            Connect your Twitch account to get your personal manager.
          </p>

          {/* Value bullets */}
          <ul className="space-y-2.5 mb-8">
            {[
              "AI coaching report after every stream",
              "Burnout detection and content strategy",
              "Weekly game plan with action items",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-sm text-muted">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-light flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-[#9146FF] hover:bg-[#7B2FE0] text-white font-semibold py-3.5 px-6 rounded-xl transition-all disabled:opacity-60 disabled:cursor-wait"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
            </svg>
            {loading ? "Connecting..." : "Connect with Twitch"}
          </button>
        </div>

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
