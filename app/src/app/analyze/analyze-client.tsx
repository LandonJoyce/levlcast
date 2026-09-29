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
import { rememberRef, track } from "@/components/funnel/track";
import { ease } from "@/lib/analysis-progress";

/** How often we ask whether the report is done. */
const POLL_MS = 4000;
/** Give up after this long. Comfortably past a normal run. */
const POLL_TIMEOUT_MS = 12 * 60 * 1000;

/**
 * The pipeline's statuses in order, what each one is doing, where it sits
 * on the progress bar, and about how long it usually takes. A whole free
 * report is about a minute and a half.
 */
const STAGES = [
  { status: "pending", label: "Pulling the stream from Twitch", from: 0, to: 0.08, seconds: 8 },
  { status: "transcribing", label: "Listening to what was said", from: 0.08, to: 0.5, seconds: 45 },
  { status: "analyzing", label: "Writing the report", from: 0.5, to: 0.99, seconds: 45 },
] as const;

/**
 * How close a free report is to done. It's a single 12-minute part, so
 * there's nothing inside a stage to count: each stage is timed from when
 * this page saw it start, against how long it usually takes. The bar never
 * goes backwards and doesn't finish until the report is in.
 */
function PreviewProgress({ status }: { status: string }) {
  const stage = STAGES.find((s) => s.status === status) ?? STAGES[0];
  // Null until mounted, so the server and the first browser render agree.
  const [since, setSince] = useState<{ status: string; at: number } | null>(null);
  const [now, setNow] = useState(0);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    setSince({ status, at: Date.now() });
    setNow(Date.now());
  }, [status]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  const elapsed = since && since.status === status ? Math.max(0, (now - since.at) / 1000) : 0;
  const fraction = Math.max(shown, stage.from + (stage.to - stage.from) * ease(elapsed / stage.seconds));
  useEffect(() => setShown(fraction), [fraction]);
  const pct = Math.round(fraction * 100);

  return (
    <div className="az-prog">
      <div className="az-prog-row">
        <span
          className="az-prog-track"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="How far along the report is"
        >
          <span style={{ width: `${(fraction * 100).toFixed(1)}%` }} />
        </span>
        <span className="az-prog-pct">{pct}%</span>
      </div>
      <p className="az-prog-now" aria-live="polite">
        {stage.label}
      </p>
    </div>
  );
}

export function AnalyzeClient({
  initialPreview,
  initialUrl,
  refParam,
}: {
  initialPreview?: PreviewPayload;
  initialUrl?: string;
  /** ?ref= on the link that brought them here, e.g. an outreach DM's code. */
  refParam?: string;
}) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [preview, setPreview] = useState<PreviewPayload | null>(initialPreview ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Whether they typed their name (so it's reading their latest stream) or pasted a link.
  const [via, setVia] = useState<"link" | "name">("link");

  // Kept in a ref so the polling effect can stop itself without being
  // re-created on every tick.
  const startedAt = useRef<number>(0);

  // Funnel: they got here. A shared preview link is a landing too.
  const landed = useRef(false);
  useEffect(() => {
    if (landed.current) return;
    landed.current = true;
    rememberRef(refParam);
    track("land", initialPreview ? "shared-preview" : "analyze");
  }, [refParam, initialPreview]);

  // Funnel: how each preview they started ended.
  const reported = useRef<string | null>(null);
  useEffect(() => {
    if (!preview || (preview.status !== "ready" && preview.status !== "failed")) return;
    const key = `${preview.twitch_vod_id}:${preview.status}`;
    if (reported.current === key || initialPreview?.twitch_vod_id === preview.twitch_vod_id) return;
    reported.current = key;
    if (preview.status === "ready") track("preview_ready", preview.twitch_vod_id);
    else track("preview_failed", `${preview.twitch_vod_id}: ${preview.failed_reason ?? ""}`);
  }, [preview, initialPreview]);

  const working =
    preview != null &&
    (preview.status === "pending" || preview.status === "transcribing" || preview.status === "analyzing");

  const run = useCallback(
    async (targetUrl: string) => {
      if (busy) return;
      setError(null);
      if (targetUrl.trim().length === 0) {
        setError("Type your Twitch name first. Or paste a link to one of your streams.");
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
          track("preview_refused", data?.error ?? `HTTP ${res.status}`);
          setBusy(false);
          return;
        }

        startedAt.current = Date.now();
        setPreview(data as PreviewPayload);
        setVia(data?.via === "name" ? "name" : "link");
        track("preview_start", `${(data as PreviewPayload).twitch_vod_id} ${data?.via === "name" ? "name" : "link"}`);
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
    const streamer = preview.streamer_display_name || preview.streamer_login;
    const length = preview.duration_seconds ? fmtDuration(preview.duration_seconds) : null;
    return (
      <main className="az-main">
        <section className="az-run">
          <p className="v3-label">{via === "name" ? "Reading your latest stream" : "Working on it"}</p>
          <h1 className="az-run-title">{preview.title || "Your stream"}</h1>
          {(streamer || length) && (
            <p className="az-run-meta">{[streamer, length].filter(Boolean).join(" · ")}</p>
          )}
          <PreviewProgress status={preview.status} />
          <p className="v3-fine">This takes a minute or two. Keep the tab open and the report shows up here.</p>
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
            Type your Twitch name. We go through the first 12 minutes of your latest stream and tell you what&apos;s
            working, what&apos;s costing you viewers, and what&apos;s worth clipping.
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
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="Your Twitch name"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={busy}
                    aria-label="Your Twitch name, or a link to one of your streams"
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
                  <span>Or paste a link to any past broadcast, from a channel&apos;s Videos tab.</span>
                )}
              </p>
            </form>
          </div>
          <p className="v3-fine">Three free reports a day. Sign in with Twitch and we read the whole stream.</p>
        </div>
      </section>
    </main>
  );
}
