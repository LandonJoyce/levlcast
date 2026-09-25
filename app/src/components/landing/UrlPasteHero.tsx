"use client";

import { useId, useState, type FormEvent } from "react";
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

/**
 * `hint` is the line under the box when there is no error. It used to say
 * "Sign in with Twitch", which stopped being true when the paste started
 * going to the free analyzer instead of OAuth. Pass null where the page
 * already says it in its own words; the line then only appears to show an
 * error.
 */
export default function UrlPasteHero({
  hint = "No sign-in, no card. Takes about a minute.",
}: {
  hint?: string | null;
} = {}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  // Per-instance, so a page with two paste boxes never has two elements
  // sharing one id.
  const helperId = useId();

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
    // Straight to the free analyzer, NOT to OAuth. A first-time visitor
    // who has just typed a link is at peak intent, and sending them to a
    // Twitch permission screen at that exact moment is where we were
    // losing them. They see a real report first; the signup ask comes
    // after it has proved itself. The pending URL is still stashed above
    // so that if they do sign up, their own VOD is queued immediately.
    router.push(`/analyze?url=${encodeURIComponent(url.trim())}`);
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
            aria-describedby={error || hint ? helperId : undefined}
            className="ll-url-hero-input"
          />
        </div>
        {/* Only disabled while submitting. Disabling it while the box was
            empty greyed out the one button the page exists for, so on first
            load the main call to action looked broken. An empty submit now
            just shows the example link below. */}
        <button
          type="submit"
          disabled={submitting}
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
      {(error || hint) && (
        <p id={helperId} className="ll-url-hero-helper">
          {error ? (
            <span className="ll-url-hero-error" role="alert">{error}</span>
          ) : (
            <span>{hint}</span>
          )}
        </p>
      )}
    </form>
  );
}
