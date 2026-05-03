"use client";

import { useState, useEffect, useCallback } from "react";

const SUBREDDITS = [
  { value: "TwitchStreamers", label: "r/TwitchStreamers" },
  { value: "Twitch_Startup", label: "r/Twitch_Startup" },
  { value: "SmallStreamers", label: "r/SmallStreamers" },
  { value: "TwitchFollowers", label: "r/TwitchFollowers" },
  { value: "StreamersCommunity", label: "r/StreamersCommunity" },
  { value: "Twitch", label: "r/Twitch" },
  { value: "streaming", label: "r/streaming" },
  { value: "ContentCreators", label: "r/ContentCreators" },
  { value: "letsplay", label: "r/letsplay" },
];


type Lead = {
  id: string;
  title: string | null;
  body: string;
  author: string;
  subreddit: string;
  url: string;
  created: number;
  flair: string | null;
  isComment?: boolean;
};

function timeAgo(utc: number) {
  const diff = Date.now() / 1000 - utc;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

export default function OutreachPage() {
  const [mode, setMode] = useState<"posts" | "comments">("posts");

  const [subreddit, setSubreddit] = useState("TwitchStreamers");

  // Shared state
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<Record<string, { body: string; subject: string }>>({});
  const [generating, setGenerating] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("outreach_sent_v1");
    if (saved) setSent(new Set(JSON.parse(saved)));
  }, []);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    setLeads([]);
    try {
      const endpoint = mode === "posts" ? "/api/outreach/leads" : "/api/outreach/leads-comments";
      const res = await fetch(`${endpoint}?subreddit=${encodeURIComponent(subreddit)}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setLeads(mode === "posts" ? (data.posts ?? []) : (data.comments ?? []));
    } catch (e: any) {
      setFetchError(e.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [mode, subreddit]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  async function generateMessage(lead: Lead) {
    setGenerating(lead.id);
    try {
      const res = await fetch("/api/outreach/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postTitle: lead.title ?? undefined,
          postBody: lead.body,
          authorName: lead.author,
          context: lead.isComment ? "comment" : "post",
        }),
      });
      const data = await res.json();
      setMessages((prev) => ({ ...prev, [lead.id]: { body: data.message, subject: data.subject ?? (lead.isComment ? "Saw your comment" : "Saw your post") } }));
    } finally {
      setGenerating(null);
    }
  }

  function copyMessage(id: string) {
    navigator.clipboard.writeText(messages[id]?.body ?? "");
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  function markSent(id: string) {
    const next = new Set([...sent, id]);
    setSent(next);
    localStorage.setItem("outreach_sent_v1", JSON.stringify([...next]));
  }

  function clearSent() {
    setSent(new Set());
    localStorage.removeItem("outreach_sent_v1");
  }

  const visibleLeads = leads.filter((l) => !sent.has(l.id));

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <span className="page-eyebrow">§ 06 · Growth</span>
        <h1 className="page-title">Reddit Outreach</h1>
        <p className="page-sub">Find streamers asking for help. AI writes a personal message. One click opens Reddit with it pre-filled.</p>
      </div>

      {/* Mode switcher */}
      <div className="row gap-sm" style={{ marginBottom: 20 }}>
        <button
          onClick={() => setMode("posts")}
          className={`btn ${mode === "posts" ? "btn-blue" : "btn-ghost"}`}
          style={{ fontSize: 12, padding: "6px 16px" }}
        >
          Posts
        </button>
        <button
          onClick={() => setMode("comments")}
          className={`btn ${mode === "comments" ? "btn-blue" : "btn-ghost"}`}
          style={{ fontSize: 12, padding: "6px 16px" }}
        >
          Comments
        </button>
      </div>

      {/* Subreddit tabs — shared by both modes */}
      <div className="tabs" style={{ marginBottom: 24 }}>
        {SUBREDDITS.map((s) => (
          <button key={s.value} className={`tab ${subreddit === s.value ? "active" : ""}`} onClick={() => setSubreddit(s.value)}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Controls row */}
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span className="mono" style={{ fontSize: 12, color: "var(--ink-3)" }}>
          {visibleLeads.length} leads · {sent.size} sent/skipped
        </span>
        <div className="row gap-md">
          {sent.size > 0 && (
            <button onClick={clearSent} style={{ fontSize: 12, background: "transparent", border: 0, color: "var(--ink-3)", cursor: "pointer", padding: 0 }}>
              Clear list
            </button>
          )}
          <button onClick={fetchLeads} className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 14px" }}>
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card card-pad" style={{ textAlign: "center", color: "var(--ink-3)", fontSize: 14, padding: "48px 24px" }}>
          Fetching leads...
        </div>
      ) : fetchError ? (
        <div className="card card-pad" style={{ textAlign: "center", padding: "48px 24px" }}>
          <p style={{ color: "#f87171", fontSize: 13, marginBottom: 16 }}>{fetchError}</p>
          <button onClick={fetchLeads} className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 16px" }}>Try again</button>
        </div>
      ) : visibleLeads.length === 0 ? (
        <div className="card card-pad" style={{ textAlign: "center", color: "var(--ink-3)", fontSize: 14, padding: "48px 24px" }}>
          No leads right now. {mode === "comments" ? "Try a different keyword." : "Try a different subreddit or refresh."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visibleLeads.map((lead) => (
            <div key={lead.id} className="card" style={{ padding: "18px 22px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="row gap-sm" style={{ marginBottom: 5, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>u/{lead.author}</span>
                    <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>r/{lead.subreddit}</span>
                    <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>{timeAgo(lead.created)}</span>
                    {lead.isComment && (
                      <span style={{ fontSize: 10, padding: "1px 6px", background: "color-mix(in oklab, var(--blue) 12%, var(--surface-2))", borderRadius: 4, color: "var(--blue)", border: "1px solid color-mix(in oklab, var(--blue) 25%, var(--line))" }}>
                        comment
                      </span>
                    )}
                    {lead.flair && (
                      <span style={{ fontSize: 10, padding: "1px 6px", background: "rgba(255,255,255,0.06)", borderRadius: 4, color: "var(--ink-3)" }}>
                        {lead.flair}
                      </span>
                    )}
                  </div>
                  {lead.title && (
                    <a href={lead.url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", textDecoration: "none", lineHeight: 1.4, display: "block", marginBottom: lead.body ? 6 : 0 }}>
                      {lead.title}
                    </a>
                  )}
                  {lead.body && (
                    <a href={lead.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                      <p style={{ fontSize: 12, color: lead.isComment ? "var(--ink-2)" : "var(--ink-3)", margin: 0, lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: lead.isComment ? 3 : 2, WebkitBoxOrient: "vertical" }}>
                        {lead.body}
                      </p>
                    </a>
                  )}
                </div>

                <div className="row gap-sm" style={{ flexShrink: 0 }}>
                  {!messages[lead.id] && (
                    <button onClick={() => generateMessage(lead)} disabled={generating === lead.id}
                      className="btn btn-blue" style={{ fontSize: 12, padding: "6px 14px", whiteSpace: "nowrap", opacity: generating === lead.id ? 0.6 : 1 }}>
                      {generating === lead.id ? "Writing..." : "Write message"}
                    </button>
                  )}
                  <button onClick={() => markSent(lead.id)}
                    style={{ fontSize: 12, padding: "6px 12px", background: "transparent", border: "1px solid var(--line)", borderRadius: 8, color: "var(--ink-3)", cursor: "pointer" }}>
                    Skip
                  </button>
                </div>
              </div>

              {messages[lead.id] && (
                <div style={{ marginTop: 14, padding: "14px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid var(--line)" }}>
                  <p style={{ fontSize: 11, color: "var(--ink-3)", margin: "0 0 6px", fontStyle: "italic" }}>
                    Subject: {messages[lead.id].subject}
                  </p>
                  <p style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.7, margin: "0 0 14px", whiteSpace: "pre-wrap" }}>
                    {messages[lead.id].body}
                  </p>
                  <div className="row gap-sm" style={{ flexWrap: "wrap" }}>
                    <a
                      href={`https://www.reddit.com/message/compose/?to=${encodeURIComponent(lead.author)}&subject=${encodeURIComponent(messages[lead.id].subject)}&message=${encodeURIComponent(messages[lead.id].body)}`}
                      target="_blank" rel="noopener noreferrer"
                      onClick={() => setTimeout(() => markSent(lead.id), 800)}
                      style={{ fontSize: 12, padding: "7px 16px", background: "rgba(255,69,0,0.12)", border: "1px solid rgba(255,69,0,0.3)", color: "#ff6314", borderRadius: 8, textDecoration: "none", fontWeight: 600 }}>
                      Send on Reddit
                    </a>
                    <button onClick={() => copyMessage(lead.id)} className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 14px" }}>
                      {copied === lead.id ? "Copied!" : "Copy"}
                    </button>
                    <button onClick={() => generateMessage(lead)} disabled={generating === lead.id}
                      style={{ fontSize: 12, padding: "6px 12px", background: "transparent", border: 0, color: "var(--ink-3)", cursor: "pointer" }}>
                      Rewrite
                    </button>
                    <button onClick={() => markSent(lead.id)}
                      style={{ fontSize: 12, padding: "6px 12px", background: "transparent", border: 0, color: "var(--ink-3)", cursor: "pointer" }}>
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
