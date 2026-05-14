"use client";

import { useState, useEffect, useCallback } from "react";

// Subreddit picker for sub-scoped browsing. Removed dead/low-volume subs
// (letsplay, TwitchFollowers, StreamersCommunity) and kept the active ones.
// Most lead-finding now happens via the Reddit-wide text search below.
const SUBREDDITS = [
  { value: "TwitchStreamers", label: "r/TwitchStreamers" },
  { value: "twitchstreaming", label: "r/twitchstreaming" },
  { value: "Twitch_Startup", label: "r/Twitch_Startup" },
  { value: "SmallStreamers", label: "r/SmallStreamers" },
  { value: "twitchfollowers", label: "r/twitchfollowers" },
  { value: "Twitch", label: "r/Twitch" },
  { value: "streaming", label: "r/streaming" },
  { value: "ContentCreators", label: "r/ContentCreators" },
  { value: "NewTubers", label: "r/NewTubers" },
  { value: "PartneredYoutube", label: "r/PartneredYoutube" },
];

// Preset Reddit-wide text searches. Phrased the way streamers actually
// post, so the matches come back as real people asking for help rather
// than random Twitch mentions. Each runs against all of Reddit and the
// API filters by the same HELP_PHRASES list before returning hits.
const SEARCH_PRESETS = [
  { value: "i stream on twitch", label: "\"i stream on twitch\"" },
  { value: "i'm a twitch streamer", label: "\"i'm a twitch streamer\"" },
  { value: "i started streaming", label: "\"i started streaming\"" },
  { value: "twitch affiliate", label: "twitch affiliate" },
  { value: "my twitch channel", label: "my twitch channel" },
  { value: "small streamer", label: "small streamer" },
  { value: "how to grow on twitch", label: "how to grow on twitch" },
  { value: "feedback on my stream", label: "feedback on my stream" },
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
  // "sub" = pick a subreddit and pull its latest posts
  // "search" = Reddit-wide text search, no subreddit constraint
  const [source, setSource] = useState<"sub" | "search">("search");
  const [subreddit, setSubreddit] = useState("TwitchStreamers");
  const [searchQuery, setSearchQuery] = useState(SEARCH_PRESETS[0].value);

  // Shared state
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<Record<string, { body: string; subject: string; skip?: boolean }>>({});
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
      // Comments endpoint stays subreddit-scoped (it always was). Posts can
      // run in either sub or search mode.
      const endpoint = mode === "posts" ? "/api/outreach/leads" : "/api/outreach/leads-comments";
      const param = mode === "posts" && source === "search"
        ? `q=${encodeURIComponent(searchQuery)}`
        : `subreddit=${encodeURIComponent(subreddit)}`;
      const res = await fetch(`${endpoint}?${param}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setLeads(mode === "posts" ? (data.posts ?? []) : (data.comments ?? []));
    } catch (e: any) {
      setFetchError(e.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [mode, source, subreddit, searchQuery]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // Fallback for when the AI decides a post isn't a fit (or the post body
  // was deleted, blocking the quote-first opener). Keeps the casual tone
  // of an actual LevlCast user reaching out, no fake observations.
  function useTemplate(lead: Lead) {
    const body = `yo! saw your ${lead.isComment ? "comment" : "post"}. LevlCast watches your VODs and tells you what to improve next stream. it also has a clipping tool so you don't have to waste time finding moments.

free to try at levlcast.com`;
    const subject = lead.isComment ? "Built a Twitch coaching tool" : "Built a Twitch coaching tool";
    setMessages((prev) => ({ ...prev, [lead.id]: { body, subject } }));
  }

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
      if (data.skip) {
        // Model decided LevlCast isn't a fit for this post. Surface that
        // verbatim so we don't paper over it with a forced DM.
        setMessages((prev) => ({
          ...prev,
          [lead.id]: {
            body: `[SKIP] ${data.reason ?? "Not a fit for LevlCast"}`,
            subject: "Skip — not a fit",
            skip: true,
          },
        }));
        return;
      }
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

  function markSent(id: string, author: string) {
    const next = new Set([...sent, id, `author:${author}`]);
    setSent(next);
    localStorage.setItem("outreach_sent_v1", JSON.stringify([...next]));
  }

  function clearSent() {
    setSent(new Set());
    localStorage.removeItem("outreach_sent_v1");
  }

  const visibleLeads = leads.filter((l) => !sent.has(l.id) && !sent.has(`author:${l.author}`));

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

      {/* Source switcher — Reddit-wide search or a specific sub. Comments
          mode forces sub since the comments endpoint is sub-scoped. */}
      {mode === "posts" && (
        <div className="row gap-sm" style={{ marginBottom: 16 }}>
          <button
            onClick={() => setSource("search")}
            className={`btn ${source === "search" ? "btn-blue" : "btn-ghost"}`}
            style={{ fontSize: 12, padding: "6px 16px" }}
            title="Search across all of Reddit for streamers mentioning Twitch"
          >
            Reddit-wide search
          </button>
          <button
            onClick={() => setSource("sub")}
            className={`btn ${source === "sub" ? "btn-blue" : "btn-ghost"}`}
            style={{ fontSize: 12, padding: "6px 16px" }}
          >
            Specific subreddit
          </button>
        </div>
      )}

      {/* Picker — preset search queries for search mode, subreddit list for sub mode */}
      <div className="tabs" style={{ marginBottom: 24 }}>
        {(mode === "posts" && source === "search" ? SEARCH_PRESETS : SUBREDDITS).map((s) => {
          const active = (mode === "posts" && source === "search") ? searchQuery === s.value : subreddit === s.value;
          return (
            <button
              key={s.value}
              className={`tab ${active ? "active" : ""}`}
              onClick={() => {
                if (mode === "posts" && source === "search") setSearchQuery(s.value);
                else setSubreddit(s.value);
              }}
            >
              {s.label}
            </button>
          );
        })}
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
                  <button onClick={() => markSent(lead.id, lead.author)}
                    style={{ fontSize: 12, padding: "6px 12px", background: "transparent", border: "1px solid var(--line)", borderRadius: 8, color: "var(--ink-3)", cursor: "pointer" }}>
                    Skip
                  </button>
                </div>
              </div>

              {messages[lead.id] && messages[lead.id].skip && (
                <div style={{ marginTop: 14, padding: "14px 16px", background: "rgba(248,113,113,0.06)", borderRadius: 10, border: "1px dashed rgba(248,113,113,0.35)" }}>
                  <p style={{ fontSize: 11, color: "#F87171", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 6px" }}>
                    Not a fit
                  </p>
                  <p style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.6, margin: "0 0 12px" }}>
                    {messages[lead.id].body.replace(/^\[SKIP\]\s*/, "")}
                  </p>
                  <div className="row gap-sm" style={{ flexWrap: "wrap" }}>
                    <button onClick={() => useTemplate(lead)}
                      style={{ fontSize: 12, padding: "7px 14px", background: "rgba(155,106,255,0.12)", border: "1px solid rgba(155,106,255,0.3)", color: "#C9B3FF", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
                      Use template
                    </button>
                    <button onClick={() => generateMessage(lead)} disabled={generating === lead.id} className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 14px" }}>
                      Try again
                    </button>
                    <button onClick={() => markSent(lead.id, lead.author)}
                      style={{ fontSize: 12, padding: "6px 12px", background: "transparent", border: 0, color: "var(--ink-3)", cursor: "pointer" }}>
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {messages[lead.id] && !messages[lead.id].skip && (
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
                      onClick={() => setTimeout(() => markSent(lead.id, lead.author), 800)}
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
                    <button onClick={() => markSent(lead.id, lead.author)}
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
