"use client";

/**
 * The no-account entry point.
 *
 * Paste a Twitch VOD link, watch it work, read a real report. No signup,
 * no OAuth, no card. This is the first thing most new visitors will touch,
 * so the failure modes get as much care as the happy path: every error is
 * a sentence someone can act on, and nothing spins forever.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { PreviewReport, fmtDuration, type PreviewPayload } from "@/components/preview/preview-report";

/** How often we ask whether the report is done. */
const POLL_MS = 4000;
/** Give up after this long. Comfortably past a normal run. */
const POLL_TIMEOUT_MS = 12 * 60 * 1000;

/** The pipeline's statuses in order, and what each one is doing. */
const STAGES = [
  { status: "pending", label: "Pulling the stream from Twitch" },
  { status: "transcribing", label: "Listening to what was said" },
  { status: "analyzing", label: "Writing the report" },
] as const;

export function AnalyzeClient({
  initialPreview,
  initialUrl,
}: {
  initialPreview?: PreviewPayload;
  initialUrl?: string;
}) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [preview, setPreview] = useState<PreviewPayload | null>(initialPreview ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Kept in a ref so the polling effect can stop itself without being
  // re-created on every tick.
  const startedAt = useRef<number>(0);

  const working =
    preview != null &&
    (preview.status === "pending" || preview.status === "transcribing" || preview.status === "analyzing");

  const run = useCallback(
    async (targetUrl: string) => {
      if (busy) return;
      setError(null);
      if (targetUrl.trim().length === 0) {
        setError("Paste a link to a Twitch stream first. It looks like twitch.tv/videos/1234567890.");
        return;
      }
      setBusy(true);
      setPreview(null);

      try {
        const res = await fetch("/api/public/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: targetUrl }),
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data?.error ?? "Something went wrong. Try again.");
          setBusy(false);
          return;
        }

        startedAt.current = Date.now();
        setPreview(data as PreviewPayload);
      } catch {
        setError("Couldn't reach the server. Check your connection and try again.");
      } finally {
        setBusy(false);
      }
    },
    [busy]
  );

  const submit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      void run(url);
    },
    [run, url]
  );

  const reset = useCallback((clearUrl: boolean) => {
    setPreview(null);
    setError(null);
    if (clearUrl) setUrl("");
    window.scrollTo({ top: 0 });
  }, []);

  // Auto-start when arriving from the landing page's paste box, which
  // hands the link over as ?url=. The visitor typed it one screen ago;
  // making them press Analyze again would be a pointless second step.
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current || initialPreview || !initialUrl) return;
    autoRan.current = true;
    void run(initialUrl);
    // `run` is stable enough here and re-running on its identity would
    // risk a second analysis; the ref guard is the real protection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUrl, initialPreview]);

  // Poll while a report is in flight.
  useEffect(() => {
    if (!working || !preview) return;
    if (startedAt.current === 0) startedAt.current = Date.now();

    let cancelled = false;
    const timer = setInterval(async () => {
      if (cancelled) return;

      if (Date.now() - startedAt.current > POLL_TIMEOUT_MS) {
        setPreview((p) =>
          p ? { ...p, status: "failed", failed_reason: "That took longer than expected. Try running it again." } : p
        );
        return;
      }

      try {
        const res = await fetch(`/api/public/analyze?vod=${encodeURIComponent(preview.twitch_vod_id)}`);
        if (!res.ok) return; // transient, so keep polling rather than failing the run
        const data = (await res.json()) as PreviewPayload;
        if (!cancelled) setPreview(data);
      } catch {
        // Network blip. Next tick tries again.
      }
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [working, preview]);

  const ready = preview?.status === "ready" && preview.coach_report;
  const failed = preview?.status === "failed";

  if (ready && preview) {
    return (
      <main className="az-main az-done">
        <PreviewReport preview={preview} />
        <button type="button" className="v3-btn v3-btn-ghost az-again" onClick={() => reset(true)}>
          Analyze another stream
        </button>
      </main>
    );
  }

  if (working && preview) {
    const current = STAGES.findIndex((s) => s.status === preview.status);
    const streamer = preview.streamer_display_name || preview.streamer_login;
    const length = preview.duration_seconds ? fmtDuration(preview.duration_seconds) : null;
    return (
      <main className="az-main">
        <section className="az-run" aria-live="polite">
          <p className="v3-label">Working on it</p>
          <h1 className="az-run-title">{preview.title || "Your stream"}</h1>
          {(streamer || length) && (
            <p className="az-run-meta">{[streamer, length].filter(Boolean).join(" · ")}</p>
          )}
          <ol className="az-stages">
            {STAGES.map((s, i) => (
              <li key={s.status} data-state={i < current ? "done" : i === current ? "now" : "todo"}>
                <span className="az-stage-mark" aria-hidden="true" />
                {s.label}
              </li>
            ))}
          </ol>
          <p className="v3-fine">This usually takes about a minute. Keep the tab open and the report shows up here.</p>
        </section>
      </main>
    );
  }

  if (failed && preview) {
    return (
      <main className="az-main">
        <section className="az-run">
          <p className="v3-label">That didn&apos;t work</p>
          <p className="az-fail">{preview.failed_reason ?? "Something went wrong reading that stream."}</p>
          <button type="button" className="v3-btn v3-btn-ghost" onClick={() => reset(false)}>
            Try another stream
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="az-main">
      <section className="az-hero">
        <div className="az-copy">
          <p className="v3-label">Free, no account</p>
          <h1 className="az-h1">Get a free report on your last stream</h1>
          <p className="v3-sub">
            Paste the link to a past broadcast. We go through the first 12 minutes and tell you what&apos;s working,
            what&apos;s costing you viewers, and what&apos;s worth clipping.
          </p>

          <div className="v3-paste">
            <form onSubmit={submit} className="ll-url-hero" noValidate>
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
                    placeholder="twitch.tv/videos/1234567890"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={busy}
                    aria-label="Twitch VOD link"
                    aria-invalid={!!error}
                    aria-describedby="az-helper"
                    className="ll-url-hero-input"
                  />
                </div>
                <button type="submit" disabled={busy} className="ll-btn ll-btn-grad ll-url-hero-submit">
                  {busy ? (
                    "Starting…"
                  ) : (
                    <>
                      Analyze it
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M5 12h14M13 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
              <p id="az-helper" className="ll-url-hero-helper">
                {error ? (
                  <span className="ll-url-hero-error" role="alert">{error}</span>
                ) : (
                  <span>On Twitch, open your channel&apos;s Videos tab and copy the link to a past broadcast.</span>
                )}
              </p>
            </form>
          </div>
          <p className="v3-fine">Three free reports a day. Sign in with Twitch and we read the whole stream.</p>
        </div>

        {/* What comes back, before anyone has to paste anything. Someone
            arriving from a DM wants to know what this is first. */}
        <aside className="v3-frame az-eg" aria-label="Example report">
          <div className="v3-result-top">
            <span>Example report</span>
            <span>First 12 min</span>
          </div>
          <div className="az-eg-score">
            <span className="az-eg-num">68</span>
            <span className="az-eg-k">Opening score</span>
          </div>
          <div className="az-eg-row">
            <p className="az-eg-k">Fix this first</p>
            <p className="az-eg-text">
              Say what today&apos;s stream is in the first minute. It took four minutes before chat could tell.
            </p>
          </div>
          <div className="az-eg-row">
            <p className="az-eg-k">Clip these</p>
            <ul className="az-eg-clips">
              <li>
                <span>4:12</span>The jump you missed three times
              </li>
              <li>
                <span>9:47</span>Chat roasting your aim
              </li>
            </ul>
          </div>
        </aside>
      </section>
    </main>
  );
}
