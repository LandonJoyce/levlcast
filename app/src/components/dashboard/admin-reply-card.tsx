"use client";

import { useEffect, useState } from "react";

interface ReplyRow {
  id: string;
  category: string;
  message: string;
  admin_reply: string;
  admin_reply_at: string;
  user_seen_reply: boolean;
  created_at: string;
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `${diffD}d ago`;
  return d.toLocaleDateString();
}

/**
 * Surfaces admin replies to the user's feedback on the dashboard.
 *
 * Only renders when the user actually has at least one reply. Server-side
 * filtering on /api/feedback/replies guarantees this user only sees their
 * own data — no chance of leaking another user's conversation.
 */
export function AdminReplyCard() {
  const [replies, setReplies] = useState<ReplyRow[] | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/feedback/replies");
        if (!res.ok) {
          if (!cancelled) setReplies([]);
          return;
        }
        const json = await res.json();
        if (!cancelled) setReplies((json.replies as ReplyRow[]) ?? []);
      } catch {
        if (!cancelled) setReplies([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (replies === null) return null;
  if (replies.length === 0) return null;

  const unread = replies.filter((r) => !r.user_seen_reply);
  const visible = expanded ? replies : (unread.length > 0 ? unread : replies.slice(0, 1));

  async function markSeen(id: string) {
    setReplies((prev) => prev ? prev.map((r) => r.id === id ? { ...r, user_seen_reply: true } : r) : prev);
    try {
      await fetch(`/api/feedback/${id}/seen`, { method: "POST" });
    } catch {
      // Failure is non-critical — next page load will re-fetch.
    }
  }

  return (
    <div
      style={{
        background: "linear-gradient(135deg, rgba(155,106,255,0.08), rgba(242,97,121,0.04))",
        border: "1px solid rgba(155,106,255,0.3)",
        borderRadius: 14,
        padding: 20,
        marginBottom: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#C9B3FF" }}>
            Reply from Landon
          </span>
          {unread.length > 0 && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              background: "rgba(242,97,121,0.15)",
              border: "1px solid rgba(242,97,121,0.35)",
              color: "#F26179",
              borderRadius: 100,
              padding: "2px 8px",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.06em",
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#F26179" }} />
              {unread.length} new
            </span>
          )}
        </div>
        {replies.length > 1 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{
              background: "none",
              border: "none",
              color: "#A6B3C9",
              fontSize: 11,
              cursor: "pointer",
              textDecoration: "underline",
              padding: 0,
            }}
          >
            {expanded ? "Show less" : `Show all ${replies.length}`}
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {visible.map((r) => (
          <div key={r.id}>
            <details
              onToggle={(e) => {
                if ((e.target as HTMLDetailsElement).open && !r.user_seen_reply) markSeen(r.id);
              }}
              style={{
                background: "rgba(7,11,20,0.5)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 10,
                padding: 14,
              }}
            >
              <summary style={{
                cursor: "pointer",
                listStyle: "none",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    margin: 0,
                    fontSize: 13,
                    lineHeight: 1.55,
                    color: "#ECF1FA",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    fontWeight: 500,
                  }}>
                    {r.admin_reply}
                  </p>
                  <div style={{ fontSize: 10, color: "#6F7C95", marginTop: 8, fontFamily: "monospace", letterSpacing: "0.04em" }}>
                    {timeAgo(r.admin_reply_at)} · view your original
                  </div>
                </div>
                {!r.user_seen_reply && (
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#F26179", flexShrink: 0, marginTop: 6 }} />
                )}
              </summary>
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: 10, color: "#6F7C95", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
                  You wrote
                </div>
                <p style={{
                  margin: 0,
                  fontSize: 12,
                  lineHeight: 1.6,
                  color: "rgba(255,255,255,0.55)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}>
                  {r.message}
                </p>
              </div>
            </details>
          </div>
        ))}
      </div>
    </div>
  );
}
