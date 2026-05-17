"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

const PENDING_KEY = "levlcast_pending_vod_url";
const MAX_URL_LENGTH = 500;

/**
 * Validate a Twitch VOD URL on the client. Mirrors the server-side regex
 * in /api/twitch/vods/analyze-by-url so the user gets immediate feedback
 * for obvious typos before we round-trip to OAuth.
 */
function isValidTwitchVodUrl(input: string): boolean {
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_URL_LENGTH) return false;
  if (/^\d{6,}$/.test(trimmed)) return true;
  return /twitch\.tv\/videos\/\d{6,}/i.test(trimmed);
}

export default function UrlPasteHero() {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!isValidTwitchVodUrl(url)) {
      setError("Paste a Twitch VOD link, e.g. https://www.twitch.tv/videos/1234567890");
      return;
    }

    setSubmitting(true);
    try {
      localStorage.setItem(PENDING_KEY, url.trim());
    } catch {
      // Private mode / storage disabled — the URL is lost but OAuth still
      // works, they just won't get the specific VOD queued. Non-fatal.
    }
    router.push("/auth/login?from=url_paste");
  }

  return (
    <form onSubmit={handleSubmit} className="ll-url-hero" noValidate>
      <div className="ll-url-hero-row">
        <div className="ll-url-hero-input-wrap">
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="ll-url-hero-icon"
            aria-hidden
          >
            <path d="M2.79 8L4.5 2h17v15.5l-4.39 3.5h-4l-2.39 2H8l-1.61-2H2.79V8z" />
            <path d="M16 6v6M11 6v6" />
          </svg>
          <input
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste your Twitch VOD link…"
            value={url}
            onChange={(e) => setUrl(e.target.value.slice(0, MAX_URL_LENGTH))}
            maxLength={MAX_URL_LENGTH}
            disabled={submitting}
            aria-label="Twitch VOD URL"
            aria-invalid={!!error}
            className="ll-url-hero-input"
          />
        </div>
        <button
          type="submit"
          disabled={submitting || url.trim().length === 0}
          className="ll-btn ll-btn-grad ll-url-hero-submit"
        >
          {submitting ? "Loading…" : (
            <>
              Analyze it
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>
      </div>
      <p className="ll-url-hero-helper">
        {error ? (
          <span className="ll-url-hero-error">{error}</span>
        ) : (
          <span>Sign in with Twitch to analyze. Free analysis is capped at 4 hours. 1 of 3 free reports.</span>
        )}
      </p>
    </form>
  );
}
