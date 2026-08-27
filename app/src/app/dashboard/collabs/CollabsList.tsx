"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { gameCategoryLabel, streamerTypeLabel, audienceBand } from "@/lib/collab-match";
import { SendInterestModal } from "./SendInterestModal";

interface CollabUser {
  user_id: string;
  display_name: string;
  twitch_login: string;
  avatar_url: string | null;
  latest_score: number | null;
  streamer_type: string | null;
  recent_game_categories: string[];
  follower_count: number | null;
  collab_types: string[];
  opt_in_at: string | null;
}

interface Props {
  sentThisMonth: number;
  sendsLimit: number | null; // null = unlimited
  isPaid: boolean;
}

export function CollabsList({ sentThisMonth: initialSent, sendsLimit, isPaid }: Props) {
  const [users, setUsers] = useState<CollabUser[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sentThisMonth, setSentThisMonth] = useState(initialSent);
  const [targetUser, setTargetUser] = useState<CollabUser | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/collab/list", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setUsers(body.users as CollabUser[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load streamers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const remaining = sendsLimit === null ? null : Math.max(0, sendsLimit - sentThisMonth);
  const canSend = sendsLimit === null || (remaining ?? 0) > 0;

  function onSent() {
    setSentThisMonth((n) => n + 1);
    setTargetUser(null);
    void load(); // refresh — the just-sent user disappears from the list
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Header row with send-cap status */}
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div className="col" style={{ gap: 2 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em", margin: 0, color: "var(--ink)" }}>
            Streamers open to collab
          </h3>
          <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
            {users === null ? "" : `${users.length} ${users.length === 1 ? "streamer" : "streamers"} found`}
          </span>
        </div>
        <div className="col" style={{ alignItems: "flex-end", gap: 2 }}>
          <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
            {sendsLimit === null
              ? "Unlimited sends this month"
              : `${remaining} send${remaining === 1 ? "" : "s"} left this month`}
          </span>
          {!isPaid && (
            <Link
              href="/dashboard/settings"
              style={{ fontSize: 11, color: "var(--ink-2)", textDecoration: "underline" }}
            >
              Upgrade for unlimited
            </Link>
          )}
        </div>
      </div>

      {/* List body */}
      <div
        className="card"
        style={{
          overflow: "hidden",
          padding: 0,
        }}
      >
        {loading && (
          <div style={{ padding: "32px 24px", color: "var(--ink-3)", fontSize: 13 }}>
            Loading streamers…
          </div>
        )}
        {!loading && error && (
          <div style={{ padding: "24px", color: "var(--danger)", fontSize: 13 }}>
            {error}
          </div>
        )}
        {!loading && !error && users && users.length === 0 && (
          <div style={{ padding: "40px 24px", textAlign: "center" }}>
            <p style={{ fontSize: 14, color: "var(--ink-2)", margin: 0 }}>
              No one&apos;s in the pool yet that matches.
            </p>
            <p style={{ fontSize: 12.5, color: "var(--ink-3)", margin: "6px 0 0" }}>
              Check back as more streamers opt in. We don&apos;t fake matches with bots.
            </p>
          </div>
        )}
        {!loading && !error && users && users.length > 0 && (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {users.map((u, idx) => (
              <li
                key={u.user_id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "16px 20px",
                  borderTop: idx === 0 ? "none" : "1px solid var(--line)",
                }}
              >
                {/* Avatar */}
                {u.avatar_url ? (
                  <img
                    src={u.avatar_url}
                    alt=""
                    width={44}
                    height={44}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      objectFit: "cover",
                      flexShrink: 0,
                      border: "1px solid var(--line)",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      background: "var(--surface-2)",
                      flexShrink: 0,
                      border: "1px solid var(--line)",
                    }}
                  />
                )}

                {/* Name + meta */}
                <div className="col" style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <div className="row" style={{ gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                    <span
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: "var(--ink)",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {u.display_name}
                    </span>
                    {u.latest_score !== null && (
                      <span
                        style={{
                          fontFamily: "var(--font-geist-mono), monospace",
                          fontSize: 11.5,
                          color: "var(--ink-2)",
                          letterSpacing: ".04em",
                        }}
                      >
                        {u.latest_score}/100
                      </span>
                    )}
                  </div>
                  <div
                    className="row"
                    style={{ gap: 14, fontSize: 12, color: "var(--ink-3)", flexWrap: "wrap" }}
                  >
                    {u.streamer_type && <span>{streamerTypeLabel(u.streamer_type)}</span>}
                    {u.recent_game_categories.length > 0 && (
                      <span>
                        {u.recent_game_categories.map(gameCategoryLabel).join(" · ")}
                      </span>
                    )}
                    <span>{audienceBand(u.follower_count)} followers</span>
                    {u.collab_types.length > 0 && (
                      <span style={{ color: "var(--ink-2)" }}>
                        Open to: {u.collab_types.map(formatCollabType).join(", ")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action */}
                <div className="row" style={{ gap: 10, flexShrink: 0 }}>
                  <a
                    href={`https://twitch.tv/${u.twitch_login}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: 12,
                      color: "var(--ink-3)",
                      textDecoration: "underline",
                      textDecorationColor: "var(--line)",
                    }}
                  >
                    Channel
                  </a>
                  <button
                    type="button"
                    onClick={() => setTargetUser(u)}
                    disabled={!canSend}
                    className={canSend ? "btn btn-primary" : "btn btn-ghost"}
                    style={{
                      padding: "8px 14px",
                      fontSize: 12.5,
                      opacity: canSend ? 1 : 0.6,
                      cursor: canSend ? "pointer" : "not-allowed",
                    }}
                    title={canSend ? "Send interest" : "Out of sends this month"}
                  >
                    Send interest
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {targetUser && (
        <SendInterestModal
          target={targetUser}
          onClose={() => setTargetUser(null)}
          onSent={onSent}
        />
      )}
    </div>
  );
}

function formatCollabType(t: string): string {
  switch (t) {
    case "co_stream": return "co-stream";
    case "variety_swap": return "variety swap";
    case "podcast": return "podcast";
    default: return t;
  }
}
