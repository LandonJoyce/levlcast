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
import { useSearchParams } from "next/navigation";
import { PreviewReport, type PreviewPayload } from "@/components/preview/preview-report";

const INK = "#ECF1FA";
const MUTED = "rgba(236,241,250,0.56)";
const PANEL = "#12151C";
const LINE = "rgba(255,255,255,0.08)";
const GRAD = "linear-gradient(135deg, rgb(255,88,0) 0%, rgb(242,97,121) 100%)";

/** How often we ask whether the report is done. */
const POLL_MS = 4000;
/** Give up after this long. Comfortably past a normal run. */
const POLL_TIMEOUT_MS = 12 * 60 * 1000;

const STAGES: Record<string, string> = {
  pending: "Pulling the stream from Twitch",
  transcribing: "Listening to what you said",
  analyzing: "Writing your report",
};

export function AnalyzeClient({ initialPreview }: { initialPreview?: PreviewPayload }) {
  const searchParams = useSearchParams();
  const [url, setUrl] = useState("");
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

  // Auto-start when arriving from the landing page's paste box, which
  // hands the link over as ?url=. The visitor typed it one screen ago;
  // making them press Analyze again would be a pointless second step.
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current || initialPreview) return;
    const incoming = searchParams.get("url");
    if (!incoming) return;
    autoRan.current = true;
    setUrl(incoming);
    void run(incoming);
    // `run` is stable enough here and re-running on its identity would
    // risk a second analysis; the ref guard is the real protection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, initialPreview]);

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
        if (!res.ok) return; // transient — keep polling rather than failing the run
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

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 20px 80px" }}>
      {/* Pitch + input */}
      {!ready ? (
        <div style={{ textAlign: "center", paddingTop: 56, paddingBottom: 28 }}>
          <h1
            style={{
              fontSize: "clamp(28px, 5vw, 42px)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: INK,
              margin: "0 0 14px",
              lineHeight: 1.1,
            }}
          >
            Paste a stream. Get coached.
          </h1>
          <p style={{ fontSize: 16, color: MUTED, margin: "0 auto 28px", maxWidth: 480, lineHeight: 1.6 }}>
            Drop any Twitch VOD link below and read a real coaching report on it. No account, no card,
            nothing to install.
          </p>

          <form onSubmit={submit} style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="twitch.tv/videos/1234567890"
              aria-label="Twitch VOD link"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              disabled={busy || working}
              style={{
                flex: "1 1 320px",
                minWidth: 0,
                background: PANEL,
                border: `1px solid ${LINE}`,
                borderRadius: 10,
                padding: "14px 16px",
                color: INK,
                fontSize: 15,
                outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={busy || working || url.trim().length === 0}
              style={{
                background: GRAD,
                border: "none",
                borderRadius: 10,
                color: "#fff",
                fontSize: 15,
                fontWeight: 700,
                padding: "14px 24px",
                cursor: busy || working ? "default" : "pointer",
                opacity: busy || working || url.trim().length === 0 ? 0.6 : 1,
              }}
            >
              {busy || working ? "Working..." : "Analyze"}
            </button>
          </form>

          {error ? (
            <p
              role="alert"
              style={{
                marginTop: 16,
                fontSize: 14,
                color: "#FCA5A5",
                background: "rgba(248,113,113,0.08)",
                border: "1px solid rgba(248,113,113,0.25)",
                borderRadius: 10,
                padding: "12px 16px",
                textAlign: "left",
              }}
            >
              {error}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Progress */}
      {working && preview ? (
        <div
          style={{
            background: PANEL,
            border: `1px solid ${LINE}`,
            borderRadius: 14,
            padding: 24,
            textAlign: "center",
          }}
        >
          <div
            aria-hidden
            style={{
              width: 34,
              height: 34,
              margin: "0 auto 16px",
              borderRadius: "50%",
              border: "3px solid rgba(255,255,255,0.12)",
              borderTopColor: "rgb(255,88,0)",
              animation: "lc-spin 0.9s linear infinite",
            }}
          />
          <p style={{ fontSize: 15, fontWeight: 600, color: INK, margin: "0 0 6px" }}>
            {STAGES[preview.status] ?? "Working"}
          </p>
          <p style={{ fontSize: 13.5, color: MUTED, margin: 0, lineHeight: 1.6 }}>
            {preview.title ? `"${preview.title}"` : "This usually takes about a minute."}
          </p>
          <p style={{ fontSize: 12.5, color: MUTED, margin: "14px 0 0" }}>
            Keep this tab open. We&apos;ll drop the report right here.
          </p>
          <style>{`@keyframes lc-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : null}

      {/* Failure */}
      {failed && preview ? (
        <div
          style={{
            background: PANEL,
            border: "1px solid rgba(248,113,113,0.25)",
            borderRadius: 14,
            padding: 24,
          }}
        >
          <p style={{ fontSize: 15, fontWeight: 700, color: INK, margin: "0 0 8px" }}>
            That one didn&apos;t work
          </p>
          <p style={{ fontSize: 14, color: MUTED, margin: "0 0 18px", lineHeight: 1.6 }}>
            {preview.failed_reason ?? "Something went wrong reading that stream."}
          </p>
          <button
            onClick={() => {
              setPreview(null);
              setError(null);
            }}
            style={{
              background: "transparent",
              border: `1px solid ${LINE}`,
              borderRadius: 10,
              color: INK,
              fontSize: 14,
              fontWeight: 600,
              padding: "11px 18px",
              cursor: "pointer",
            }}
          >
            Try another stream
          </button>
        </div>
      ) : null}

      {/* Result */}
      {ready && preview ? (
        <div style={{ paddingTop: 36 }}>
          <PreviewReport preview={preview} />
          <div style={{ textAlign: "center", marginTop: 22 }}>
            <button
              onClick={() => {
                setPreview(null);
                setUrl("");
                setError(null);
              }}
              style={{
                background: "transparent",
                border: `1px solid ${LINE}`,
                borderRadius: 10,
                color: MUTED,
                fontSize: 13.5,
                padding: "10px 18px",
                cursor: "pointer",
              }}
            >
              Analyze another stream
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
