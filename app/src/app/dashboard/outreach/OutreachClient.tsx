"use client";

import { useState, useEffect, useCallback } from "react";

const GAMES = [
  { value: "", label: "All games" },
  { value: "Just Chatting", label: "Just Chatting" },
  { value: "Minecraft", label: "Minecraft" },
  { value: "Fortnite", label: "Fortnite" },
  { value: "Valorant", label: "Valorant" },
  { value: "League of Legends", label: "League of Legends" },
  { value: "Apex Legends", label: "Apex Legends" },
  { value: "Call of Duty", label: "Call of Duty" },
  { value: "Grand Theft Auto V", label: "GTA V" },
];

type Lead = {
  id: string;
  title: string;
  body: string;
  author: string;
  url: string;
  viewers: number;
  game: string;
  created: number;
  flair: string | null;
};

function timeAgo(utc: number) {
  const diff = Date.now() / 1000 - utc;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

export default function OutreachPage() {
  const [game, setGame] = useState("");
  const [posts, setPosts] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("outreach_sent_v2");
    if (saved) setSent(new Set(JSON.parse(saved)));
  }, []);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/outreach/leads?game=${encodeURIComponent(game)}`);
      const data = await res.json();
      if (data.error) { setFetchError(data.error); setPosts([]); return; }
      setPosts(data.posts ?? []);
    } catch (e: any) {
      setFetchError(e.message ?? "Network error");
    } finally {
      setLoading(false);
    }
  }, [game]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  async function generateMessage(post: Lead) {
    setGenerating(post.id);
    try {
      const res = await fetch("/api/outreach/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postTitle: post.title,
          postBody: `${post.author} is live on Twitch playing ${post.game} with ${post.viewers} viewer${post.viewers === 1 ? "" : "s"}. Stream title: "${post.title}"`,
          authorName: post.author,
        }),
      });
      const data = await res.json();
      setMessages((prev) => ({ ...prev, [post.id]: data.message }));
    } finally {
      setGenerating(null);
    }
  }

  function copyMessage(postId: string) {
    navigator.clipboard.writeText(messages[postId]);
    setCopied(postId);
    setTimeout(() => setCopied(null), 2000);
  }

  function markSent(postId: string) {
    const next = new Set([...sent, postId]);
    setSent(next);
    localStorage.setItem("outreach_sent_v2", JSON.stringify([...next]));
  }

  function clearSent() {
    setSent(new Set());
    localStorage.removeItem("outreach_sent_v2");
  }

  const visiblePosts = posts.filter((p) => !sent.has(p.id));

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <span className="page-eyebrow">§ 06 · Growth</span>
        <h1 className="page-title">Streamer Outreach</h1>
        <p className="page-sub">Small Twitch streamers live right now. AI writes a personal message — copy it and reach out.</p>
      </div>

      <div className="tabs" style={{ marginBottom: 24, flexWrap: "wrap" }}>
        {GAMES.map((g) => (
          <button
            key={g.value}
            className={`tab ${game === g.value ? "active" : ""}`}
            onClick={() => setGame(g.value)}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span className="mono" style={{ fontSize: 12, color: "var(--ink-3)" }}>
          {visiblePosts.length} leads · {sent.size} skipped
        </span>
        <div className="row gap-md">
          {sent.size > 0 && (
            <button onClick={clearSent} style={{ fontSize: 12, background: "transparent", border: 0, color: "var(--ink-3)", cursor: "pointer", padding: 0 }}>
              Clear list
            </button>
          )}
          <button onClick={fetchPosts} className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 14px" }}>
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card card-pad" style={{ textAlign: "center", color: "var(--ink-3)", fontSize: 14, padding: "48px 24px" }}>
          Finding streamers...
        </div>
      ) : fetchError ? (
        <div className="card card-pad" style={{ textAlign: "center", padding: "48px 24px" }}>
          <p style={{ color: "#f87171", fontSize: 13, marginBottom: 16 }}>{fetchError}</p>
          <button onClick={fetchPosts} className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 16px" }}>Try again</button>
        </div>
      ) : visiblePosts.length === 0 ? (
        <div className="card card-pad" style={{ textAlign: "center", color: "var(--ink-3)", fontSize: 14, padding: "48px 24px" }}>
          No leads. Try a different game or refresh.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visiblePosts.map((post) => (
            <div key={post.id} className="card" style={{ padding: "18px 22px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="row gap-sm" style={{ marginBottom: 5, flexWrap: "wrap" }}>
                    <a href={post.url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 13, fontWeight: 700, color: "var(--blue)", textDecoration: "none" }}>
                      {post.author}
                    </a>
                    <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>{post.game}</span>
                    <span style={{ fontSize: 10, padding: "1px 6px", background: "rgba(34,197,94,0.1)", borderRadius: 4, color: "#4ade80" }}>
                      {post.viewers} viewer{post.viewers === 1 ? "" : "s"}
                    </span>
                    <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>live {timeAgo(post.created)}</span>
                  </div>
                  <p style={{ fontSize: 13, color: "var(--ink)", margin: 0, lineHeight: 1.4 }}>{post.title}</p>
                </div>

                <div className="row gap-sm" style={{ flexShrink: 0 }}>
                  {!messages[post.id] && (
                    <button
                      onClick={() => generateMessage(post)}
                      disabled={generating === post.id}
                      className="btn btn-blue"
                      style={{ fontSize: 12, padding: "6px 14px", whiteSpace: "nowrap", opacity: generating === post.id ? 0.6 : 1 }}
                    >
                      {generating === post.id ? "Writing..." : "Write message"}
                    </button>
                  )}
                  <button
                    onClick={() => markSent(post.id)}
                    style={{ fontSize: 12, padding: "6px 12px", background: "transparent", border: "1px solid var(--line)", borderRadius: 8, color: "var(--ink-3)", cursor: "pointer" }}
                  >
                    Skip
                  </button>
                </div>
              </div>

              {messages[post.id] && (
                <div style={{ marginTop: 14, padding: "14px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid var(--line)" }}>
                  <p style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.7, margin: "0 0 14px", whiteSpace: "pre-wrap" }}>
                    {messages[post.id]}
                  </p>
                  <div className="row gap-sm" style={{ flexWrap: "wrap" }}>
                    <button
                      onClick={() => copyMessage(post.id)}
                      className="btn btn-blue"
                      style={{ fontSize: 12, padding: "7px 16px" }}
                    >
                      {copied === post.id ? "Copied!" : "Copy message"}
                    </button>
                    <a
                      href={post.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 12, padding: "7px 14px",
                        background: "rgba(145,71,255,0.12)", border: "1px solid rgba(145,71,255,0.3)",
                        color: "#a78bfa", borderRadius: 8, textDecoration: "none", fontWeight: 600,
                      }}
                    >
                      Open Twitch
                    </a>
                    <button
                      onClick={() => generateMessage(post)}
                      disabled={generating === post.id}
                      style={{ fontSize: 12, padding: "6px 12px", background: "transparent", border: 0, color: "var(--ink-3)", cursor: "pointer" }}
                    >
                      Rewrite
                    </button>
                    <button
                      onClick={() => markSent(post.id)}
                      style={{ fontSize: 12, padding: "6px 12px", background: "transparent", border: 0, color: "var(--ink-3)", cursor: "pointer" }}
                    >
                      Mark done
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
