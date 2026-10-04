"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Review threads: paste the link to a "drop your Twitch name and I'll look
 * at your last stream" thread, and everyone who replied gets their free
 * report and a reply written from it. Nothing posts from here; each reply
 * is copied and posted by hand under the person's comment.
 *
 * State lives in this browser (localStorage), so a refresh keeps the
 * thread, and "Check again" picks up new comments without re-running the
 * people already done.
 */

type ItemState = "no_name" | "queued" | "waiting" | "ready" | "canned" | "problem" | "done";

type Item = {
  key: string;
  author: string | null;
  comment: string | null;
  permalink: string | null;
  login: string | null;
  guess: string | null;
  state: ItemState;
  vodId?: string;
  url?: string;
  reply?: string;
  problem?: string;
};

type Entry = Pick<Item, "key" | "author" | "comment" | "permalink" | "login" | "guess">;

const STORE_KEY = "lc-review-thread-v1";
const BATCH = 10;
const POLL_MS = 6000;

function load(): { input: string; items: Item[] } {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { input: "", items: [] };
}

const box: React.CSSProperties = {
  padding: "8px 10px",
  background: "var(--surface-2)",
  border: "1px solid var(--line)",
  borderRadius: 8,
  color: "var(--ink)",
  fontSize: 13,
};
const linkBtn: React.CSSProperties = {
  fontSize: 12,
  padding: "6px 12px",
  background: "transparent",
  border: 0,
  color: "var(--ink-3)",
  cursor: "pointer",
  textDecoration: "none",
};

export function ReviewThreadCard() {
  const [input, setInput] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [restored, setRestored] = useState(false);
  const starting = useRef(false);
  const polling = useRef(false);
  // The poll reads the list through this, so its timer isn't reset by every change.
  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;

  useEffect(() => {
    const saved = load();
    setInput(saved.input);
    setItems(saved.items);
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ input, items }));
    } catch {}
  }, [input, items, restored]);

  const patch = useCallback((key: string, p: Partial<Item>) => {
    setItems((list) => list.map((it) => (it.key === key ? { ...it, ...p } : it)));
  }, []);

  /** Read the thread (or the pasted names) and add anyone new. */
  async function check() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/outreach/reviews?input=${encodeURIComponent(input.trim())}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't read that.");
      const entries = (json.entries ?? []) as Entry[];
      setItems((list) => {
        const known = new Set(list.map((it) => it.key));
        const fresh = entries
          .filter((e) => !known.has(e.key))
          .map((e): Item => ({ ...e, state: e.login ? "queued" : "no_name" }));
        return [...list, ...fresh];
      });
      if (entries.length === 0) setError("No replies yet. The mirror can be a few minutes behind Reddit, so check again soon.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that.");
    } finally {
      setLoading(false);
    }
  }

  // Start reports for anyone queued, a batch at a time.
  useEffect(() => {
    const queued = items.filter((it) => it.state === "queued" && it.login).slice(0, BATCH);
    if (queued.length === 0 || starting.current) return;
    starting.current = true;
    (async () => {
      try {
        const res = await fetch("/api/outreach/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ logins: queued.map((it) => it.login) }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Couldn't start them.");
        const byLogin = new Map<string, { state: string; vodId?: string; canned?: string | null }>(
          (json.results ?? []).map((r: { login: string }) => [r.login, r])
        );
        setItems((list) =>
          list.map((it) => {
            if (it.state !== "queued" || !it.login || !queued.some((q) => q.key === it.key)) return it;
            const r = byLogin.get(it.login);
            if (!r) return { ...it, state: "problem", problem: "Not a valid Twitch name." };
            if (r.state === "ready" || r.state === "waiting") return { ...it, state: "waiting", vodId: r.vodId };
            if (r.canned) return { ...it, state: "canned", reply: r.canned };
            if (r.state === "cap") return { ...it, state: "problem", problem: "Hit the daily report limit. Try again later." };
            return { ...it, state: "problem", problem: "Couldn't start the report." };
          })
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Couldn't start them.";
        setItems((list) =>
          list.map((it) => (queued.some((q) => q.key === it.key) ? { ...it, state: "problem", problem: msg } : it))
        );
      } finally {
        starting.current = false;
      }
    })();
  }, [items]);

  // Check on running reports and write each reply once its report is done.
  useEffect(() => {
    const timer = setInterval(async () => {
      if (polling.current) return;
      const waiting = itemsRef.current.filter((it) => it.state === "waiting" && it.vodId).slice(0, 3);
      if (waiting.length === 0) return;
      polling.current = true;
      try {
        for (const it of waiting) {
          const res = await fetch("/api/outreach/reviews/reply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ vodId: it.vodId, author: it.author, comment: it.comment }),
          });
          const json = await res.json().catch(() => ({}));
          if (json.status === "ready") patch(it.key, { state: "ready", reply: json.reply, url: json.url });
          else if (json.status === "failed" || json.status === "draft_failed" || !res.ok)
            patch(it.key, { state: "problem", problem: json.reason ?? json.error ?? "Something went wrong.", url: json.url });
          else if (json.url) patch(it.key, { url: json.url });
        }
      } finally {
        polling.current = false;
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [patch]);

  async function copy(it: Item) {
    if (!it.reply) return;
    try {
      await navigator.clipboard.writeText(it.reply);
      setCopied(it.key);
      setTimeout(() => setCopied((c) => (c === it.key ? null : c)), 1500);
    } catch {}
  }

  function runName(it: Item) {
    const login = (names[it.key] ?? it.guess ?? "").trim().replace(/^@/, "").toLowerCase();
    if (!/^[a-z0-9_]{3,25}$/.test(login)) return;
    patch(it.key, { login, state: "queued", problem: undefined });
  }

  function clearAll() {
    setItems([]);
    setInput("");
    setError(null);
  }

  const count = (s: ItemState) => items.filter((it) => it.state === s).length;
  const toPost = count("ready") + count("canned");
  const running = count("queued") + count("waiting");

  return (
    <div className="card" style={{ marginBottom: 20, overflow: "hidden" }}>
      <div className="card-head">
        <h3>Review thread</h3>
        <div className="right">
          {items.length > 0 && (
            <span className="label-mono">
              {items.length} people · {toPost} to post{running ? ` · ${running} running` : ""} · {count("done")} posted
            </span>
          )}
        </div>
      </div>
      <div className="card-pad" style={{ display: "grid", gap: 10 }}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-3)", lineHeight: 1.55 }}>
          Paste the link to your review thread, or Twitch names one per line. Everyone gets their free report and a reply
          written from it. You post the replies yourself.
        </p>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="https://www.reddit.com/r/TwitchStreaming/comments/..."
          rows={2}
          style={{ ...box, resize: "vertical", fontFamily: "inherit" }}
        />
        <div className="row gap-md" style={{ justifyContent: "flex-end", alignItems: "center" }}>
          {items.length > 0 && (
            <button onClick={clearAll} style={linkBtn}>
              Clear
            </button>
          )}
          <button
            onClick={check}
            disabled={loading || !input.trim()}
            className="btn btn-blue"
            style={{ fontSize: 12, padding: "7px 16px", opacity: loading || !input.trim() ? 0.5 : 1 }}
          >
            {loading ? "Reading..." : items.length > 0 ? "Check again" : "Run reviews"}
          </button>
        </div>
        {error && <p style={{ margin: 0, fontSize: 12, color: "#F87171" }}>{error}</p>}
      </div>

      {items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", borderTop: "1px solid var(--line)" }}>
          {items.map((it) => (
            <div key={it.key} style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)", opacity: it.state === "done" ? 0.55 : 1 }}>
              <div className="row gap-sm" style={{ flexWrap: "wrap", alignItems: "baseline", marginBottom: it.comment && it.state !== "done" ? 4 : 0 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                  {it.author ? `u/${it.author}` : it.login}
                </span>
                {it.author && it.login && (
                  <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                    twitch.tv/{it.login}
                  </span>
                )}
                <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {it.state === "queued" || it.state === "waiting"
                    ? "Running report"
                    : it.state === "no_name"
                      ? "No name found"
                      : it.state === "problem"
                        ? "Problem"
                        : it.state === "done"
                          ? "Posted"
                          : "Ready to post"}
                </span>
              </div>

              {it.comment && it.state !== "done" && (
                <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--ink-3)", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                  {it.comment}
                </p>
              )}

              {it.state === "no_name" && (
                <div className="row gap-sm" style={{ alignItems: "center" }}>
                  <input
                    value={names[it.key] ?? it.guess ?? ""}
                    onChange={(e) => setNames((n) => ({ ...n, [it.key]: e.target.value }))}
                    placeholder="their twitch name"
                    style={{ ...box, width: 200 }}
                  />
                  <button onClick={() => runName(it)} className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 14px" }}>
                    Run
                  </button>
                  <button onClick={() => patch(it.key, { state: "done" })} style={linkBtn}>
                    Skip
                  </button>
                  {it.guess && !names[it.key] && (
                    <span style={{ fontSize: 11, color: "var(--ink-3)" }}>Guessed from their comment, check it first.</span>
                  )}
                </div>
              )}

              {it.state === "problem" && (
                <div className="row gap-sm" style={{ alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: "#F87171" }}>{it.problem}</span>
                  <button
                    onClick={() => patch(it.key, { state: it.vodId && it.problem?.startsWith("Couldn't write") ? "waiting" : "queued", problem: undefined })}
                    className="btn btn-ghost"
                    style={{ fontSize: 12, padding: "6px 14px" }}
                  >
                    Try again
                  </button>
                  {it.url && (
                    <a href={it.url} target="_blank" rel="noopener noreferrer" style={linkBtn}>
                      Report
                    </a>
                  )}
                  <button onClick={() => patch(it.key, { state: "done" })} style={linkBtn}>
                    Skip
                  </button>
                </div>
              )}

              {(it.state === "ready" || it.state === "canned") && it.reply && (
                <div style={{ padding: "12px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid var(--line)" }}>
                  <p style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.7, margin: "0 0 12px", whiteSpace: "pre-wrap" }}>{it.reply}</p>
                  <div className="row gap-sm" style={{ flexWrap: "wrap" }}>
                    <button onClick={() => copy(it)} className="btn btn-blue" style={{ fontSize: 12, padding: "6px 16px" }}>
                      {copied === it.key ? "Copied!" : "Copy"}
                    </button>
                    {it.permalink && (
                      <a href={it.permalink} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 14px", textDecoration: "none" }}>
                        Open their comment
                      </a>
                    )}
                    {it.url && (
                      <a href={it.url} target="_blank" rel="noopener noreferrer" style={linkBtn}>
                        Report
                      </a>
                    )}
                    {it.state === "ready" && (
                      <button onClick={() => patch(it.key, { state: "waiting", reply: undefined })} style={linkBtn}>
                        Rewrite
                      </button>
                    )}
                    <button onClick={() => patch(it.key, { state: "done" })} style={linkBtn}>
                      Mark posted
                    </button>
                  </div>
                </div>
              )}

              {it.state === "done" && (
                <button
                  onClick={() => patch(it.key, { state: it.reply ? (it.vodId ? "ready" : "canned") : it.login ? "queued" : "no_name" })}
                  style={{ ...linkBtn, padding: 0 }}
                >
                  Undo
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
