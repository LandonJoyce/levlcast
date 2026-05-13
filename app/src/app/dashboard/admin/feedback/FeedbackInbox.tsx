"use client";

import { useState } from "react";

interface FeedbackRow {
  id: string;
  user_id: string | null;
  email: string | null;
  category: string;
  message: string;
  context: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
}

interface Props {
  initialFeedback: FeedbackRow[];
}

const CATEGORY_LABEL: Record<string, string> = {
  failure: "Failure",
  bug: "Bug",
  general: "General",
  feature_request: "Feature",
};

const CATEGORY_COLOR: Record<string, string> = {
  failure: "#F87171",
  bug: "#F59E0B",
  general: "#9B6AFF",
  feature_request: "#22D3EE",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return d.toLocaleString();
}

export function FeedbackInbox({ initialFeedback }: Props) {
  const [feedback, setFeedback] = useState<FeedbackRow[]>(initialFeedback);
  const [filter, setFilter] = useState<"all" | "unread" | string>("unread");

  const filtered = feedback.filter((f) => {
    if (filter === "all") return true;
    if (filter === "unread") return !f.read;
    return f.category === filter;
  });

  const unreadCount = feedback.filter((f) => !f.read).length;

  async function toggleRead(id: string, read: boolean) {
    setFeedback((prev) => prev.map((f) => (f.id === id ? { ...f, read } : f)));
    try {
      await fetch(`/api/admin/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read }),
      });
    } catch {
      // Revert UI on failure
      setFeedback((prev) => prev.map((f) => (f.id === id ? { ...f, read: !read } : f)));
    }
  }

  async function deleteFeedback(id: string) {
    if (!confirm("Delete this feedback permanently?")) return;
    const previous = feedback;
    setFeedback((prev) => prev.filter((f) => f.id !== id));
    try {
      const res = await fetch(`/api/admin/feedback/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
    } catch {
      setFeedback(previous);
      alert("Could not delete. Try again.");
    }
  }

  const filterButtons: Array<{ value: typeof filter; label: string }> = [
    { value: "unread", label: `Unread (${unreadCount})` },
    { value: "all", label: `All (${feedback.length})` },
    { value: "failure", label: "Failures" },
    { value: "bug", label: "Bugs" },
    { value: "feature_request", label: "Features" },
    { value: "general", label: "General" },
  ];

  return (
    <div style={{ padding: "32px 24px", maxWidth: 920, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, fontFamily: "monospace", letterSpacing: "0.2em", textTransform: "uppercase", color: "#6F7C95", marginBottom: 6 }}>
            Admin
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#ECF1FA", margin: 0 }}>Feedback inbox</h1>
        </div>
        <div style={{ fontSize: 13, color: "#6F7C95" }}>{unreadCount} unread</div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
        {filterButtons.map((b) => {
          const active = filter === b.value;
          return (
            <button
              key={b.value}
              onClick={() => setFilter(b.value)}
              style={{
                padding: "7px 13px",
                background: active ? "rgba(155,106,255,0.15)" : "transparent",
                border: `1px solid ${active ? "rgba(155,106,255,0.4)" : "rgba(255,255,255,0.08)"}`,
                color: active ? "#ECF1FA" : "#A6B3C9",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {b.label}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: "60px 0", textAlign: "center", color: "#6F7C95", fontSize: 14 }}>
          No feedback matching that filter.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((f) => {
            const color = CATEGORY_COLOR[f.category] ?? "#9B6AFF";
            const ctx = f.context as Record<string, unknown> | null;
            return (
              <div
                key={f.id}
                style={{
                  background: f.read ? "#0C111C" : "#0F1626",
                  border: `1px solid ${f.read ? "rgba(255,255,255,0.06)" : "rgba(155,106,255,0.25)"}`,
                  borderRadius: 12,
                  padding: "18px 20px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color,
                      background: `${color}1A`,
                      border: `1px solid ${color}33`,
                      padding: "3px 8px",
                      borderRadius: 6,
                    }}
                  >
                    {CATEGORY_LABEL[f.category] ?? f.category}
                  </span>
                  <span style={{ fontSize: 13, color: "#ECF1FA", fontWeight: 600 }}>
                    {f.email ?? "(no email)"}
                  </span>
                  <span style={{ fontSize: 12, color: "#6F7C95", fontFamily: "monospace", marginLeft: "auto" }}>
                    {formatDate(f.created_at)}
                  </span>
                </div>

                <p style={{
                  margin: "0 0 12px",
                  fontSize: 14,
                  lineHeight: 1.55,
                  color: "#ECF1FA",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}>
                  {f.message}
                </p>

                {ctx && Object.keys(ctx).length > 0 && (
                  <details style={{ marginBottom: 10 }}>
                    <summary style={{ cursor: "pointer", fontSize: 11, color: "#6F7C95", fontFamily: "monospace" }}>
                      context
                    </summary>
                    <pre style={{
                      margin: "8px 0 0",
                      padding: 10,
                      background: "#070B14",
                      border: "1px solid rgba(255,255,255,0.05)",
                      borderRadius: 8,
                      fontSize: 11,
                      lineHeight: 1.5,
                      color: "#A6B3C9",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      overflowX: "auto",
                    }}>{JSON.stringify(ctx, null, 2)}</pre>
                  </details>
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => toggleRead(f.id, !f.read)}
                    style={{
                      padding: "6px 12px",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "#A6B3C9",
                      borderRadius: 7,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {f.read ? "Mark unread" : "Mark read"}
                  </button>
                  <button
                    onClick={() => deleteFeedback(f.id)}
                    style={{
                      padding: "6px 12px",
                      background: "transparent",
                      border: "1px solid rgba(248,113,113,0.25)",
                      color: "#F87171",
                      borderRadius: 7,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
