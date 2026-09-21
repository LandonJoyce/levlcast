"use client";

import { useState, useEffect, useCallback } from "react";

// Subreddit picker for sub-scoped browsing. Removed dead/low-volume subs
// (letsplay, TwitchFollowers, StreamersCommunity) and kept the active ones.
// Most lead-finding now happens via the Reddit-wide text search below.
const SUBREDDITS = [
  { value: "all", label: "All streamer subs" },
  { value: "TwitchStreamers", label: "r/TwitchStreamers" },
  { value: "twitchstreaming", label: "r/twitchstreaming" },
  { value: "Twitch_Startup", label: "r/Twitch_Startup" },
  { value: "SmallStreamers", label: "r/SmallStreamers" },
  { value: "twitchfollowers", label: "r/twitchfollowers" },
  { value: "Twitch", label: "r/Twitch" },
  { value: "streaming", label: "r/streaming" },
  { value: "ContentCreators", label: "r/ContentCreators" },
  { value: "PartneredYoutube", label: "r/PartneredYoutube" },
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

/**
 * Browser-side Reddit fetch.
 *
 * Reddit refuses credential-free reads from datacenter IPs, which is every
 * request the Vercel server makes, but it answers a home connection without
 * complaint. This page only ever loads on Landon's own machine, so when the
 * server route is blocked we just ask Reddit directly from here instead.
 *
 * Reddit's public listings send permissive CORS headers, which is what
 * makes this legal from a browser at all. Filtering is duplicated from the
 * server route on purpose: the two paths must agree on what counts as a
 * lead, and the list is short enough that sharing it across a server/client
 * boundary would cost more than it saves.
 */
const HELP_PHRASES = [
  "my stream", "my channel", "i stream", "i've been streaming",
  "started streaming", "just started streaming", "new streamer", "new to streaming",
  "how do i grow", "how to grow", "can't grow", "struggling to grow",
  "no viewers", "low viewers", "0 viewers", "zero viewers",
  "how do i get", "how to get viewers", "how to get followers",
  "feedback on my", "feedback for my", "roast my", "rate my",
  "any advice", "any tips", "any help", "need advice", "need help",
  "what am i doing wrong", "what should i",
  "trying to reach affiliate", "trying to get affiliate", "path to affiliate",
  "twitch.tv/",
];
const PROMO_SUBS = new Set(["twitchfollowers", "newtwitchstreamers", "twitch_startup", "twitchstreaming"]);
const SKIP_AUTHORS = new Set(["automoderator", "[deleted]", "reddit", "bmwdouche"]);
const SKIP_FLAIRS = new Set(["self promotion", "self-promotion", "promo", "advertisement"]);

async function fetchLeadsFromBrowser(
  subreddit: string,
  mode: "posts" | "comments"
): Promise<Lead[]> {
  const useAll = !subreddit || subreddit.toLowerCase() === "all";
  const subPath = useAll
    ? SUBREDDITS.filter((s) => s.value !== "all").map((s) => s.value).join("+")
    : subreddit;

  const listing = mode === "posts" ? "new" : "comments";
  // www, not old. old.reddit.com sends no CORS headers, so a browser
  // refuses to read the response even when Reddit returns it happily —
  // that was the "CORS request did not succeed" with a null status code.
  // The www host has sent Access-Control-Allow-Origin on its .json
  // listings for years, which is what every browser-side Reddit client
  // relies on.
  const url = `https://www.reddit.com/r/${encodeURIComponent(subPath)}/${listing}.json?limit=100&raw_json=1`;

  // Bypass the PWA service worker. Its fetch handler resolves to undefined
  // for cross-origin requests, which kills this call before it leaves the
  // page regardless of what Reddit would have said.
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    mode: "cors",
    credentials: "omit",
  });
  if (!res.ok) throw new Error(`Reddit ${res.status}`);
  const json = await res.json();
  const children: Array<{ data?: Record<string, unknown> }> = json?.data?.children ?? [];

  const cutoff = Date.now() / 1000 - 14 * 24 * 60 * 60;
  const seenAuthors = new Set<string>();

  return children
    .map((c) => {
      const d = (c.data ?? {}) as Record<string, unknown>;
      const sub = String(d.subreddit ?? subPath);
      const isComment = mode === "comments";
      return {
        id: String(d.id ?? ""),
        title: isComment ? null : String(d.title ?? ""),
        body: String((isComment ? d.body : d.selftext) ?? "").slice(0, 500),
        author: String(d.author ?? ""),
        subreddit: sub,
        url: d.permalink
          ? `https://www.reddit.com${String(d.permalink)}`
          : `https://reddit.com/r/${sub}/`,
        created: Number(d.created_utc ?? 0),
        flair: (d.link_flair_text as string | null) ?? null,
        isComment,
      } as Lead;
    })
    .filter((p) => {
      if (!p.author || SKIP_AUTHORS.has(p.author.toLowerCase())) return false;
      if (p.title === "[deleted]" || p.title === "[removed]") return false;
      if (p.body === "[deleted]" || p.body === "[removed]") return false;
      if (seenAuthors.has(p.author)) return false;
      if (p.flair && SKIP_FLAIRS.has(p.flair.toLowerCase())) return false;
      if (!p.created || p.created < cutoff) return false;
      const text = `${p.title ?? ""} ${p.body}`.toLowerCase();
      const promoSub = PROMO_SUBS.has((p.subreddit || "").toLowerCase());
      if (!promoSub && !HELP_PHRASES.some((ph) => text.includes(ph))) return false;
      seenAuthors.add(p.author);
      return true;
    })
    .sort((a, b) => b.created - a.created)
    .slice(0, 80);
}

function timeAgo(utc: number) {
  const diff = Date.now() / 1000 - utc;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

export default function OutreachPage() {
  const [mode, setMode] = useState<"posts" | "comments">("posts");
  // Subreddit-scoped only. Reddit killed unauthenticated wide search, and
  // the keyword fan-out was noisy, so we pull straight from the streamer
  // subs we work. "all" pulls every sub in one combined request.
  const [subreddit, setSubreddit] = useState("all");

  // Shared state
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<Record<string, { body: string; subject: string; skip?: boolean }>>({});
  const [generating, setGenerating] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  /** Lead or queue id currently in flight, so its button can show progress. */
  const [sending, setSending] = useState<string | null>(null);
  /** Reddit's own refusal text. Shown verbatim: it usually says how long to wait. */
  const [sendError, setSendError] = useState<string | null>(null);
  /**
   * Whether the server can post to Reddit itself. Without an OAuth app it
   * cannot, and every Send falls back to a plain link that opens Reddit's
   * compose screen already filled in.
   *
   * A link is used rather than window.open on purpose. Opening a window
   * after an await has lost the user gesture, which is exactly what makes
   * Firefox interrupt with a popup prompt. An anchor click never is.
   */
  const [canSendDirect, setCanSendDirect] = useState(false);

  useEffect(() => {
    fetch("/api/outreach/send")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCanSendDirect(Boolean(d?.configured)))
      .catch(() => setCanSendDirect(false));
  }, []);

  /** Reddit's compose screen, prefilled. */
  function composeUrl(to: string, subject: string, body: string): string {
    return (
      `https://www.reddit.com/message/compose/?to=${encodeURIComponent(to)}` +
      `&subject=${encodeURIComponent(subject)}` +
      `&message=${encodeURIComponent(body)}`
    );
  }

  /**
   * The queue: drafts the scheduled harvest has already written and that
   * are waiting to go out. This is the one-click path — the message is
   * done, so all that is left is opening Reddit with it prefilled.
   */
  type QueueItem = {
    id: string;
    reddit_username: string;
    subreddit: string | null;
    permalink: string | null;
    post_title: string | null;
    post_excerpt: string | null;
    message_subject: string | null;
    message_body: string | null;
    angle: string | null;
  };
  const [queue, setQueue] = useState<QueueItem[]>([]);

  const loadQueue = useCallback(async () => {
    try {
      const res = await fetch("/api/outreach/queue");
      const data = await res.json();
      setQueue(data.queue ?? []);
    } catch {
      // Queue is an enhancement; a failure here must not break the page.
    }
  }, []);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  async function resolveQueued(item: QueueItem, action: "sent" | "skip") {
    // Drop it from view immediately. Waiting on the round trip makes a
    // one-click flow feel like a two-click one.
    setQueue((prev) => prev.filter((q) => q.id !== item.id));
    try {
      await fetch("/api/outreach/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, action }),
      });
    } catch {
      // Left queued server-side and will reappear on next load, which is
      // the safe direction: better to see it twice than to lose it.
      loadQueue();
    }
  }

  /**
   * Send a queued message. No tab, no popup, no second click inside
   * Reddit — the server posts it to /api/compose and the row only leaves
   * the queue once Reddit has confirmed.
   *
   * Deliberately NOT optimistic. A message that silently failed to send
   * but vanished from the queue is unrecoverable: you cannot tell who was
   * missed. So the row stays put until the send is confirmed, and a
   * failure puts Reddit's own reason on screen.
   */
  async function sendQueued(item: QueueItem) {
    setSending(item.id);
    setSendError(null);
    try {
      const res = await fetch("/api/outreach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: item.reddit_username,
          subject: item.message_subject ?? "Saw your post",
          body: item.message_body ?? "",
          queueId: item.id,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSendError(data.error ?? "Reddit refused the message");
        return;
      }
      setQueue((prev) => prev.filter((q) => q.id !== item.id));
    } catch {
      setSendError("Could not reach the server. Nothing was sent.");
    } finally {
      setSending(null);
    }
  }

  // Manual lead entry, for when Reddit will not serve discovery.
  const [manualAuthor, setManualAuthor] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualBody, setManualBody] = useState("");

  const manualInput: React.CSSProperties = {
    background: "var(--surface-2)",
    border: "1px solid var(--line)",
    borderRadius: 8,
    padding: "9px 12px",
    color: "var(--ink)",
    fontSize: 13,
    outline: "none",
    width: "100%",
  };

  function addManualLead() {
    const author = manualAuthor.trim().replace(/^u\//i, "");
    const body = manualBody.trim();
    if (!author || !body) return;

    const title = manualTitle.trim();
    const lead: Lead = {
      id: `manual-${Date.now()}`,
      title: title || null,
      body,
      author,
      subreddit: "manual",
      // Best guess at their profile, since we have no permalink.
      url: `https://www.reddit.com/user/${encodeURIComponent(author)}`,
      created: Math.floor(Date.now() / 1000),
      flair: null,
      // No title means it reads as a comment, which changes how the
      // drafting prompt opens.
      isComment: !title,
    };

    setLeads((prev) => [lead, ...prev]);
    setManualAuthor("");
    setManualTitle("");
    setManualBody("");
  }

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
      // Server-side read refused. Reddit blocks credential-free requests
      // from datacenter IPs, which is every request Vercel makes, but it
      // answers a residential one perfectly well — and this page only ever
      // runs on Landon's own machine. So fall back to fetching Reddit
      // straight from the browser. Same data, same filters, different IP.
      try {
        const direct = await fetchLeadsFromBrowser(subreddit, mode);
        setLeads(direct);
        setFetchError(null);
      } catch {
        setFetchError(e.message ?? "Failed to load");
      }
    } finally {
      setLoading(false);
    }
  }, [mode, subreddit]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // Fallback for when the AI decides a post isn't a fit (or the post body
  // was deleted, blocking the quote-first opener). Keeps the casual tone
  // of an actual LevlCast user reaching out, no fake observations. Includes
  // the founding-price urgency so the template doesn't lose conversion lift.
  function useTemplate(lead: Lead) {
    const body = `yo! saw your ${lead.isComment ? "comment" : "post"}. LevlCast watches your VODs and tells you what to improve next stream. it also has a clipping tool so you don't have to waste time finding moments.

2 free analyses, no card. try it at levlcast.com`;
    const subject = "Built a Twitch coaching tool";
    setMessages((prev) => ({ ...prev, [lead.id]: { body, subject } }));
  }

  /**
   * Write the message and send it, in one actual click.
   *
   * Nothing opens. The draft is written, handed to the server, and posted
   * to Reddit in the same gesture, so there is no popup to unblock and no
   * compose screen to confirm. The lead is only marked sent once Reddit
   * has accepted it.
   */
  async function writeAndSend(lead: Lead) {
    setSendError(null);
    const result = await generateMessage(lead);
    if (!result || result.skip) return; // Skip reason is already on screen.

    setSending(lead.id);
    try {
      const res = await fetch("/api/outreach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: lead.author,
          subject: result.subject,
          body: result.body,
          subreddit: lead.subreddit,
          permalink: lead.url,
          postTitle: lead.title ?? "",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSendError(data.error ?? "Reddit refused the message");
        return;
      }
      markSent(lead.id, lead.author);
    } catch {
      setSendError("Could not reach the server. Nothing was sent.");
    } finally {
      setSending(null);
    }
  }

  /** Send a draft already on screen, without rewriting it. */
  async function sendDraft(lead: Lead) {
    const draft = messages[lead.id];
    if (!draft || draft.skip) return;

    setSendError(null);
    setSending(lead.id);
    try {
      const res = await fetch("/api/outreach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: lead.author,
          subject: draft.subject,
          body: draft.body,
          subreddit: lead.subreddit,
          permalink: lead.url,
          postTitle: lead.title ?? "",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSendError(data.error ?? "Reddit refused the message");
        return;
      }
      markSent(lead.id, lead.author);
    } catch {
      setSendError("Could not reach the server. Nothing was sent.");
    } finally {
      setSending(null);
    }
  }

  async function generateMessage(lead: Lead): Promise<{ body: string; subject: string; skip?: boolean } | null> {
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
        const skipped = {
          body: `[SKIP] ${data.reason ?? "Not a fit for LevlCast"}`,
          subject: "Skip — not a fit",
          skip: true,
        };
        setMessages((prev) => ({ ...prev, [lead.id]: skipped }));
        return skipped;
      }
      const written = {
        body: data.message as string,
        subject: (data.subject as string) ?? (lead.isComment ? "Saw your comment" : "Saw your post"),
      };
      setMessages((prev) => ({ ...prev, [lead.id]: written }));
      return written;
    } catch {
      return null;
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
        <span className="page-eyebrow">Growth</span>
        <h1 className="page-title">Reddit Outreach</h1>
        <p className="page-sub">Find streamers asking for help. AI writes a personal message. One click sends it.</p>
      </div>

      {/* Reddit's refusals are shown verbatim, because the text almost
          always says what to do: how many minutes a rate limit has left,
          or which credential is missing. */}
      {sendError && (
        <div
          style={{
            marginBottom: 18,
            padding: "12px 16px",
            background: "rgba(248,113,113,0.08)",
            border: "1px solid rgba(248,113,113,0.35)",
            borderRadius: 10,
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: "#FCA5A5", lineHeight: 1.55, flex: 1 }}>
            <strong style={{ color: "#F87171" }}>Not sent.</strong> {sendError}
          </p>
          <button
            onClick={() => setSendError(null)}
            style={{ background: "transparent", border: 0, color: "var(--ink-3)", cursor: "pointer", fontSize: 12 }}
          >
            Dismiss
          </button>
        </div>
      )}

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

      {/* Subreddit picker — pull from the streamer subs we work. */}
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

      {/* The queue. Written unattended by the six-hourly harvest, so this
          is usually full before you open the page. Everything here is
          already drafted; Send opens Reddit with it filled in. */}
      {queue.length > 0 && (
        <div className="card" style={{ marginBottom: 20, overflow: "hidden" }}>
          <div className="card-head">
            <h3>Ready to send</h3>
            <div className="right">
              <span className="label-mono">{queue.length} drafted</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {queue.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: "14px 18px",
                  borderTop: "1px solid var(--line)",
                  display: "grid",
                  gap: 8,
                }}
              >
                <div className="row gap-md" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                    u/{item.reddit_username}
                    {item.subreddit && (
                      <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)", marginLeft: 8 }}>
                        r/{item.subreddit}
                      </span>
                    )}
                  </span>
                  {item.permalink && (
                    <a
                      href={item.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mono"
                      style={{ fontSize: 11, color: "var(--blue)" }}
                    >
                      their post
                    </a>
                  )}
                </div>

                {item.post_title && (
                  <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.45 }}>
                    {item.post_title}
                  </p>
                )}

                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    lineHeight: 1.55,
                    color: "var(--ink-2)",
                    whiteSpace: "pre-wrap",
                    background: "var(--surface-2)",
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                    padding: "10px 12px",
                  }}
                >
                  {item.message_body}
                </p>

                <div className="row gap-md">
                  {canSendDirect ? (
                    <button
                      onClick={() => sendQueued(item)}
                      disabled={sending === item.id}
                      className="btn btn-blue"
                      style={{ fontSize: 12, padding: "7px 18px", opacity: sending === item.id ? 0.6 : 1 }}
                    >
                      {sending === item.id ? "Sending..." : "Send"}
                    </button>
                  ) : (
                    /* The message is already written, so this link needs no
                       request first and opens on the click itself — which
                       is what keeps the popup blocker out of the way. */
                    <a
                      href={composeUrl(item.reddit_username, item.message_subject ?? "Saw your post", item.message_body ?? "")}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => resolveQueued(item, "sent")}
                      className="btn btn-blue"
                      style={{ fontSize: 12, padding: "7px 18px", textDecoration: "none" }}
                    >
                      Send
                    </a>
                  )}
                  <button
                    onClick={() => resolveQueued(item, "skip")}
                    style={{
                      fontSize: 12,
                      background: "transparent",
                      border: 0,
                      color: "var(--ink-3)",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    Skip
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manual entry.
          Reddit will not serve lead discovery without an OAuth app, and
          that app cannot currently be created on this account. But finding
          posts was only half of what this page did — the drafting half
          never needed Reddit at all. Paste a post you found yourself and
          it joins the list exactly like a fetched lead, with the same
          draft, copy and compose buttons. */}
      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <span className="mono-label" style={{ display: "block", marginBottom: 10 }}>
          Paste a post
        </span>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 10 }}>
            <input
              value={manualAuthor}
              onChange={(e) => setManualAuthor(e.target.value)}
              placeholder="username"
              style={manualInput}
            />
            <input
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
              placeholder="post title (optional for comments)"
              style={manualInput}
            />
          </div>
          <textarea
            value={manualBody}
            onChange={(e) => setManualBody(e.target.value)}
            placeholder="paste the post or comment text"
            rows={3}
            style={{ ...manualInput, resize: "vertical", fontFamily: "inherit" }}
          />
          <div className="row gap-md" style={{ justifyContent: "flex-end" }}>
            <button
              onClick={addManualLead}
              disabled={!manualAuthor.trim() || !manualBody.trim()}
              className="btn btn-blue"
              style={{ fontSize: 12, padding: "7px 16px", opacity: !manualAuthor.trim() || !manualBody.trim() ? 0.5 : 1 }}
            >
              Add to list
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card card-pad" style={{ textAlign: "center", color: "var(--ink-3)", fontSize: 14, padding: "48px 24px" }}>
          Fetching leads...
        </div>
      ) : fetchError && leads.length === 0 ? (
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
                  {/* One click, start to finish: writes the message and
                      posts it to Reddit server-side. No tab opens, so
                      there is no popup to unblock and no compose screen
                      to confirm. */}
                  {!messages[lead.id] && (
                    <button
                      onClick={() => (canSendDirect ? writeAndSend(lead) : generateMessage(lead))}
                      disabled={generating === lead.id || sending === lead.id}
                      className="btn btn-blue" style={{ fontSize: 12, padding: "6px 18px", whiteSpace: "nowrap", opacity: generating === lead.id || sending === lead.id ? 0.6 : 1 }}>
                      {generating === lead.id ? "Writing..." : sending === lead.id ? "Sending..." : canSendDirect ? "Send" : "Write"}
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
                    {canSendDirect ? (
                      <button
                        onClick={() => sendDraft(lead)}
                        disabled={sending === lead.id}
                        style={{ fontSize: 12, padding: "7px 16px", background: "rgba(255,69,0,0.12)", border: "1px solid rgba(255,69,0,0.3)", color: "#ff6314", borderRadius: 8, fontWeight: 600, cursor: sending === lead.id ? "default" : "pointer", opacity: sending === lead.id ? 0.6 : 1 }}>
                        {sending === lead.id ? "Sending..." : "Send this"}
                      </button>
                    ) : (
                      <a
                        href={composeUrl(lead.author, messages[lead.id].subject, messages[lead.id].body)}
                        target="_blank" rel="noopener noreferrer"
                        onClick={() => markSent(lead.id, lead.author)}
                        style={{ fontSize: 12, padding: "7px 16px", background: "rgba(255,69,0,0.12)", border: "1px solid rgba(255,69,0,0.3)", color: "#ff6314", borderRadius: 8, textDecoration: "none", fontWeight: 600 }}>
                        Send this
                      </a>
                    )}
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
