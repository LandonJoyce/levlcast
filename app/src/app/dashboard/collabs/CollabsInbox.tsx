"use client";

import { useEffect, useState, useCallback } from "react";
import { gameCategoryLabel, streamerTypeLabel, audienceBand } from "@/lib/collab-match";

interface InboxItem {
  id: string;
  intro_text: string;
  created_at: string;
  sender: {
    display_name: string;
    twitch_login: string;
    avatar_url: string | null;
    latest_score: number | null;
    streamer_type: string | null;
    recent_game_categories: string[];
    follower_count: number | null;
  };
}

interface Props {
  initialCount: number;
}

export function CollabsInbox({ initialCount }: Props) {
  const [items, setItems] = useState<InboxItem[] | null>(null);
  const [loading, setLoading] = useState(initialCount > 0);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [acceptedHandles, setAcceptedHandles] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/collab/interest/inbox", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setItems(body.interests as InboxItem[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load inbox");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialCount > 0) void load();
    else {
      setItems([]);
      setLoading(false);
    }
  }, [initialCount, load]);

  async function respond(item: InboxItem, action: "accept" | "pass") {
    setActing(item.id);
    try {
      const res = await fetch("/api/collab/interest/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interest_id: item.id, action }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error || `Could not ${action} (HTTP ${res.status})`);
        return;
      }
      if (action === "accept") {
        // Surface the sender's Discord handle inline for immediate use.
        const handleRes = await fetch(`/api/collab/interest/${item.id}/handle`, { cache: "no-store" });
        if (handleRes.ok) {
          const h = await handleRes.json();
          if (h.discord_handle) {
            setAcceptedHandles((prev) => ({ ...prev, [item.id]: h.discord_handle }));
          }
        }
        // Remove the item from pending list — it's been handled.
        setItems((prev) => prev?.filter((i) => i.id !== item.id) ?? null);
      } else {
        setItems((prev) => prev?.filter((i) => i.id !== item.id) ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not respond");
    } finally {
      setActing(null);
    }
  }

  // Hide entirely when there's nothing actionable AND no error to surface.
  // initialCount=0 means we know upfront there are no pending interests.
  if (
    initialCount === 0 &&
    !loading &&
    !error &&
    Object.keys(acceptedHandles).length === 0
  ) {
    return null;
  }

  return (
    <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="col" style={{ gap: 2 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em", margin: 0, color: "var(--ink)" }}>
          Your inbox
        </h3>
        <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
          {loading
            ? "Loading…"
            : `${items?.length ?? 0} pending interest${(items?.length ?? 0) === 1 ? "" : "s"}`}
        </span>
      </div>

      {error && (
        <div style={{ fontSize: 12.5, color: "var(--danger)" }}>{error}</div>
      )}

      {Object.entries(acceptedHandles).map(([id, handle]) => (
        <div
          key={`accepted-${id}`}
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid color-mix(in oklab, var(--green) 30%, var(--line))",
            background: "color-mix(in oklab, var(--green-soft) 25%, var(--surface-2))",
            fontSize: 13,
            color: "var(--ink)",
          }}
        >
          Accepted. Their Discord:{" "}
          <span style={{ fontFamily: "var(--font-geist-mono), monospace", fontWeight: 700 }}>
            {handle}
          </span>
        </div>
      ))}

      {items && items.length > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((it) => (
            <li
              key={it.id}
              style={{
                display: "flex",
                gap: 14,
                padding: "14px 16px",
                borderRadius: 10,
                border: "1px solid var(--line)",
                background: "var(--surface-2)",
              }}
            >
              {it.sender.avatar_url ? (
                <img
                  src={it.sender.avatar_url}
                  alt=""
                  width={40}
                  height={40}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    objectFit: "cover",
                    flexShrink: 0,
                    border: "1px solid var(--line)",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: "var(--surface)",
                    flexShrink: 0,
                    border: "1px solid var(--line)",
                  }}
                />
              )}

              <div className="col" style={{ flex: 1, minWidth: 0, gap: 6 }}>
                <div className="row" style={{ gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                    {it.sender.display_name}
                  </span>
                  {it.sender.latest_score !== null && (
                    <span
                      style={{
                        fontFamily: "var(--font-geist-mono), monospace",
                        fontSize: 11.5,
                        color: "var(--ink-2)",
                        letterSpacing: ".04em",
                      }}
                    >
                      {it.sender.latest_score}/100
                    </span>
                  )}
                </div>
                <div
                  className="row"
                  style={{ gap: 14, fontSize: 11.5, color: "var(--ink-3)", flexWrap: "wrap" }}
                >
                  {it.sender.streamer_type && <span>{streamerTypeLabel(it.sender.streamer_type)}</span>}
                  {it.sender.recent_game_categories.length > 0 && (
                    <span>{it.sender.recent_game_categories.map(gameCategoryLabel).join(" · ")}</span>
                  )}
                  <span>{audienceBand(it.sender.follower_count)} followers</span>
                </div>
                <p
                  style={{
                    fontSize: 13.5,
                    color: "var(--ink)",
                    margin: "6px 0 0",
                    padding: "10px 12px",
                    borderLeft: "2px solid var(--ink-3)",
                    background: "var(--surface)",
                    borderRadius: "0 8px 8px 0",
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {it.intro_text}
                </p>
              </div>

              <div className="col" style={{ gap: 6, flexShrink: 0, alignItems: "flex-end" }}>
                <button
                  type="button"
                  disabled={acting === it.id}
                  onClick={() => respond(it, "accept")}
                  className="btn btn-primary"
                  style={{ padding: "7px 14px", fontSize: 12.5 }}
                >
                  Accept
                </button>
                <button
                  type="button"
                  disabled={acting === it.id}
                  onClick={() => respond(it, "pass")}
                  className="btn btn-ghost"
                  style={{ padding: "7px 14px", fontSize: 12.5 }}
                >
                  Pass
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
