"use client";

import { useState, useEffect, useRef } from "react";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCategory?: "general" | "failure" | "bug" | "feature_request";
  context?: Record<string, unknown> | null;
  trigger?: string;
}

const CATEGORIES: Array<{ value: "general" | "failure" | "bug" | "feature_request"; label: string }> = [
  { value: "general", label: "General" },
  { value: "failure", label: "Something failed" },
  { value: "bug", label: "Bug" },
  { value: "feature_request", label: "Feature idea" },
];

const MAX_LEN = 2000;
const MIN_LEN = 4;

export function FeedbackModal({
  isOpen,
  onClose,
  defaultCategory = "general",
  context = null,
  trigger,
}: FeedbackModalProps) {
  const [category, setCategory] = useState<typeof CATEGORIES[number]["value"]>(defaultCategory);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCategory(defaultCategory);
      setMessage("");
      setSubmitting(false);
      setDone(false);
      setError(null);
      setTimeout(() => textRef.current?.focus(), 50);
    }
  }, [isOpen, defaultCategory]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function submit() {
    const trimmed = message.trim();
    if (trimmed.length < MIN_LEN) {
      setError("Add a few more words so I know what's up.");
      return;
    }
    if (trimmed.length > MAX_LEN) {
      setError("Too long. Max 2000 characters.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const enrichedContext = {
        ...(context ?? {}),
        ...(trigger ? { trigger } : {}),
        page: typeof window !== "undefined" ? window.location.pathname : null,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      };
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, message: trimmed, context: enrichedContext }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "Could not send. Try again.");
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Network error. Try again.");
      setSubmitting(false);
    }
  }

  const charCount = message.length;
  const overlong = charCount > MAX_LEN;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "var(--surface, #181311)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 16,
          padding: "28px 28px 24px",
          width: "100%",
          maxWidth: 520,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 11, fontFamily: "monospace", letterSpacing: "0.2em", textTransform: "uppercase", color: "#6F7C95", marginBottom: 8 }}>
              Send Feedback
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: "#ECF1FA", margin: 0, lineHeight: 1.25 }}>
              Tell Landon what happened
            </h2>
            <p style={{ fontSize: 13, color: "#6F7C95", marginTop: 6, lineHeight: 1.5 }}>
              Goes straight to me. I read every message.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", color: "#6F7C95", fontSize: 20, cursor: "pointer", padding: "0 0 0 16px", lineHeight: 1, flexShrink: 0 }}
          >
            ✕
          </button>
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "20px 0 22px" }} />

        {done ? (
          <div style={{ padding: "20px 0 8px" }}>
            <div style={{ fontSize: 15, color: "#ECF1FA", marginBottom: 8, fontWeight: 600 }}>Sent. Thanks.</div>
            <p style={{ fontSize: 13, color: "#6F7C95", margin: 0, lineHeight: 1.5 }}>
              I&apos;ll read it and follow up if I can fix it.
            </p>
            <button
              onClick={onClose}
              style={{
                marginTop: 18,
                width: "100%",
                padding: "12px 18px",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#ECF1FA",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#ECF1FA", marginBottom: 10 }}>Category</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}>
              {CATEGORIES.map((c) => {
                const active = category === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCategory(c.value)}
                    style={{
                      padding: "10px 14px",
                      background: active ? "rgba(155,106,255,0.12)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${active ? "rgba(155,106,255,0.5)" : "rgba(255,255,255,0.08)"}`,
                      color: active ? "#ECF1FA" : "#A6B3C9",
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background 0.15s, border 0.15s",
                    }}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#ECF1FA" }}>Message</div>
              <div style={{ fontSize: 11, fontFamily: "monospace", color: overlong ? "#F87171" : "#6F7C95" }}>
                {charCount}/{MAX_LEN}
              </div>
            </div>
            <textarea
              ref={textRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What happened? Be specific so I can fix it."
              rows={6}
              maxLength={MAX_LEN + 100}
              style={{
                width: "100%",
                padding: "12px 14px",
                background: "#070B14",
                border: `1px solid ${overlong ? "rgba(248,113,113,0.5)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 10,
                color: "#ECF1FA",
                fontSize: 14,
                lineHeight: 1.5,
                fontFamily: "inherit",
                resize: "vertical",
                outline: "none",
                boxSizing: "border-box",
              }}
              disabled={submitting}
            />

            {error && (
              <p style={{ margin: "10px 0 0", fontSize: 12, color: "#F87171" }}>{error}</p>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
              <button
                onClick={onClose}
                disabled={submitting}
                style={{
                  flex: 1,
                  padding: "12px 18px",
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#A6B3C9",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: submitting ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={submitting || charCount < MIN_LEN || overlong}
                style={{
                  flex: 1,
                  padding: "12px 18px",
                  background: submitting || charCount < MIN_LEN || overlong
                    ? "rgba(155,106,255,0.25)"
                    : "linear-gradient(135deg, #9B6AFF, #F26179)",
                  border: "none",
                  color: "#fff",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: submitting || charCount < MIN_LEN || overlong ? "not-allowed" : "pointer",
                  transition: "opacity 0.15s",
                }}
              >
                {submitting ? "Sending…" : "Send"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
