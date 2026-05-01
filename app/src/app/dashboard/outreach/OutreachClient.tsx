"use client";

import { useState, useEffect, useCallback } from "react";

const SUBREDDITS = [
  { value: "TwitchStreamers", label: "r/TwitchStreamers" },
  { value: "Twitch_Startup", label: "r/Twitch_Startup" },
  { value: "TwitchFollowers", label: "r/TwitchFollowers" },
  { value: "Twitch", label: "r/Twitch" },
  { value: "NewTwitchStreamers", label: "r/NewTwitchStreamers" },
  { value: "StreamersCommunity", label: "r/StreamersCommunity" },
  { value: "GameStreaming", label: "r/GameStreaming" },
  { value: "letsplay", label: "r/letsplay" },
];

type Post = {
  id: string;
  title: string;
  body: string;
  author: string;
  subreddit: string;
  url: string;
  score: number;
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
  const [subreddit, setSubreddit] = useState("TwitchStreamers");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("outreach_sent_v1");
    if (saved) setSent(new Set(JSON.parse(saved)));
  }, []);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/outreach/leads?subreddit=${subreddit}`);
      const data = await res.json();
      if (data.error) { setFetchError(data.error); setPosts([]); return; }
      setPosts(data.posts ?? []);
    } catch (e: any) {
      setFetchError(e.message ?? "Network error");
    } finally {
      setLoading(false);
    }
  }, [subreddit]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  async function generateMessage(post: Post) {
    setGenerating(post.id);
    try {
      const res = await fetch("/api/outreach/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postTitle: post.title, postBody: post.body, authorName: post.author }),
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
    localStorage.setItem("outreach_sent_v1", JSON.stringify([...next]));
  }

  function clearSent() {
    setSent(new Set());
    localStorage.removeItem("outreach_sent_v1");
  }

  const visiblePosts = posts.filter((p) => !sent.has(p.id));

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <span className="page-eyebrow">§ 06 · Growth</span>
        <h1 className="page-title">Reddit Outreach</h1>
        <p className="page-sub">Find streamers asking for help. AI writes a personal message. One click opens Reddit with it pre-filled.</p>
      </div>

      <div className="tabs" style={{ marginBottom: 24 }}>
        {SUBREDDITS.map((s) => (
          <button
            key={s.value}
            className={`tab ${subreddit === s.value ? "active" : ""}`}
            onClick={() => setSubreddit(s.value)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span className="mono" style={{ fontSize: 12, color: "var(--ink-3)" }}>
          {visiblePosts.length} leads · {sent.size} sent/skipped
        </span>
        <div className="row gap-md">
          {sent.size > 0 && (
            <button onClick={clearSent} style={{ fontSize: 12, background: "transparent", border: 0, color: "var(--ink-3)", cursor: "pointer", padding: 0 }}>
              Clear sent list
            </button>
          )}
          <button onClick={fetchPosts} className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 14px" }}>
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card card-pad" style={{ textAlign: "center", color: "var(--ink-3)", fontSize: 14, padding: "48px 24px" }}>
          Fetching leads...
        </div>
      ) : fetchError ? (
        <div className="card card-pad" style={{ textAlign: "center", color: "#f87171", fontSize: 14, padding: "48px 24px" }}>
          Error: {fetchError}
        </div>
      ) : visiblePosts.length === 0 ? (
        <div className="card card-pad" style={{ textAlign: "center", color: "var(--ink-3)", fontSize: 14, padding: "48px 24px" }}>
          No leads right now. Try a different subreddit or refresh.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visiblePosts.map((post) => (
            <div key={post.id} className="card" style={{ padding: "18px 22px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="row gap-sm" style={{ marginBottom: 5, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>u/{post.author}</span>
                    <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>r/{post.subreddit}</span>
                    <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>{timeAgo(post.created)}</span>
                    {post.flair && (
                      <span style={{ fontSize: 10, padding: "1px 6px", background: "rgba(255,255,255,0.06)", borderRadius: 4, color: "var(--ink-3)" }}>
                        {post.flair}
                      </span>
                    )}
                  </div>
                  <a
                    href={post.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", textDecoration: "none", lineHeight: 1.4, display: "block", marginBottom: post.body ? 6 : 0 }}
                  >
                    {post.title}
                  </a>
                  {post.body && (
                    <p style={{
                      fontSize: 12, color: "var(--ink-3)", margin: 0, lineHeight: 1.5,
                      overflow: "hidden", display: "-webkit-box",
                      WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                    }}>
                      {post.body}
                    </p>
                  )}
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
                    <a
                      href={`https://www.reddit.com/message/compose/?to=${encodeURIComponent(post.author)}&subject=${encodeURIComponent("Your stream")}&message=${encodeURIComponent(messages[post.id])}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setTimeout(() => markSent(post.id), 800)}
                      style={{
                        fontSize: 12, padding: "7px 16px",
                        background: "rgba(255,69,0,0.12)", border: "1px solid rgba(255,69,0,0.3)",
                        color: "#ff6314", borderRadius: 8, textDecoration: "none", fontWeight: 600,
                      }}
                    >
                      Send on Reddit
                    </a>
                    <button
                      onClick={() => copyMessage(post.id)}
                      className="btn btn-ghost"
                      style={{ fontSize: 12, padding: "6px 14px" }}
                    >
                      {copied === post.id ? "Copied!" : "Copy"}
                    </button>
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
                      Mark sent
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
