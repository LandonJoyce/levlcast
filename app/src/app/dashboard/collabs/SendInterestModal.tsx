"use client";

import { useEffect, useRef, useState } from "react";

interface Target {
  user_id: string;
  display_name: string;
}

interface Props {
  target: Target;
  onClose: () => void;
  onSent: () => void;
}

export function SendInterestModal({ target, onClose, onSent }: Props) {
  const [intro, setIntro] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Focus on open + Esc to close
  useEffect(() => {
    textareaRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const trimmed = intro.trim();
  const remaining = 200 - intro.length;
  const canSend = trimmed.length > 0 && intro.length <= 200 && !sending;

  async function submit() {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/collab/interest/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient_id: target.user_id, intro_text: trimmed }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error || `Could not send (HTTP ${res.status})`);
        return;
      }
      onSent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "grid",
        placeItems: "center",
        zIndex: 200,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 16,
          padding: "24px 22px 20px",
        }}
      >
        <h2
          style={{
            fontSize: 17,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            margin: "0 0 4px",
            color: "var(--ink)",
          }}
        >
          Reach out to {target.display_name}
        </h2>
        <p
          style={{
            margin: "0 0 16px",
            fontSize: 12.5,
            color: "var(--ink-3)",
            lineHeight: 1.5,
          }}
        >
          Quick intro of who you are and what you&apos;d want to collab on. If they accept, you both get each other&apos;s Discord. If they pass, you won&apos;t be notified and the pair is closed.
        </p>

        <textarea
          ref={textareaRef}
          value={intro}
          onChange={(e) => setIntro(e.target.value.slice(0, 250))}
          placeholder="Hey, I stream variety / FFXIV mostly. Saw your scores and thought we could swap channels for a Sunday run."
          rows={4}
          style={{
            width: "100%",
            padding: "12px 14px",
            fontSize: 13.5,
            lineHeight: 1.55,
            borderRadius: 10,
            border: "1px solid var(--line)",
            background: "var(--surface-2)",
            color: "var(--ink)",
            outline: "none",
            resize: "none",
            fontFamily: "inherit",
            boxSizing: "border-box",
          }}
        />
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
          <span style={{ fontSize: 11.5, color: remaining < 0 ? "var(--danger)" : "var(--ink-3)" }}>
            {remaining} characters left
          </span>
          <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
            One shot per pair · no re-sends
          </span>
        </div>

        {error && (
          <div
            style={{
              marginTop: 12,
              padding: "8px 12px",
              fontSize: 12.5,
              color: "var(--danger)",
              background: "color-mix(in oklab, var(--danger-soft) 30%, transparent)",
              borderRadius: 8,
            }}
          >
            {error}
          </div>
        )}

        <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost"
            disabled={sending}
            style={{ padding: "8px 14px", fontSize: 12.5 }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            className="btn btn-primary"
            style={{
              padding: "8px 18px",
              fontSize: 12.5,
              opacity: canSend ? 1 : 0.5,
              cursor: canSend ? "pointer" : "not-allowed",
            }}
          >
            {sending ? "Sending…" : "Send interest"}
          </button>
        </div>
      </div>
    </div>
  );
}
