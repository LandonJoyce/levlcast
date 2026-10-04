"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { REVIEW_SUBS, modmailUrl, submitUrl } from "@/lib/review-subs";

/**
 * Review threads: post "drop your Twitch name and I'll look at your last
 * stream" in the streamer subs, and everyone who replies gets their free
 * report and a reply written from it.
 *
 * Post opens Reddit with the thread filled in, one more click to post. The
 * server can't post by itself: that needs a Reddit API app, which Reddit
 * wouldn't create for this account (the same reason DMs open a compose
 * page). Subs whose rules ban tool posts get a message to the mods
 * instead, and their Post button only appears once the mods say yes.
 *
 * Threads posted from the outreach account are found on their own, and
 * while this page is open their replies are read every few minutes.
 * Replies are never posted from here; each is copied and posted by hand.
 *
 * State lives in this browser (localStorage), so a refresh keeps it, and a
 * check picks up new comments without re-running anyone already done.
 */

type ItemState = "no_name" | "queued" | "waiting" | "ready" | "canned" | "problem" | "done";

type Item = {
  key: string;
  author: string | null;
  comment: string | null;
  permalink: string | null;
  login: string | null;
  guess: string | null;
  sub?: string | null;
  state: ItemState;
  vodId?: string;
  url?: string;
  reply?: string;
  problem?: string;
};

type Entry = Pick<Item, "key" | "author" | "comment" | "permalink" | "login" | "guess" | "sub">;

type Thread = { id: string; sub: string; title: string; url: string; created: number; comments: number; removed: boolean };

/** Per sub: when the mods were asked, whether they said yes, when Post was last pressed. */
type SubMarks = Record<string, { asked?: string; approved?: boolean; opened?: string }>;

const STORE_KEY = "lc-review-thread-v1";
const SUBS_KEY = "lc-review-subs-v1";
const BATCH = 10;
const POLL_MS = 6000;
/** How often an open page reads the threads again for new replies. */
const RECHECK_MS = 5 * 60 * 1000;

function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {}
  return fallback;
}

function ago(unixSeconds: number): string {
  const s = Math.max(0, Date.now() / 1000 - unixSeconds);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
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
const smallBtn: React.CSSProperties = { fontSize: 12, padding: "6px 14px", textDecoration: "none", whiteSpace: "nowrap" };

export function ReviewThreadCard() {
  const [input, setInput] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [marks, setMarks] = useState<SubMarks>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [restored, setRestored] = useState(false);
  const starting = useRef(false);
  const polling = useRef(false);
  const checking = useRef(false);
  // Timers read these, so they aren't reset by every change.
  const itemsRef = useRef<Item[]>([]);
  const inputRef = useRef("");
  const threadsRef = useRef<Thread[]>([]);
  itemsRef.current = items;
  inputRef.current = input;
  threadsRef.current = threads;

  useEffect(() => {
    const saved = readStore<{ input: string; items: Item[] }>(STORE_KEY, { input: "", items: [] });
    setInput(saved.input);
    setItems(saved.items);
    setMarks(readStore<SubMarks>(SUBS_KEY, {}));
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ input, items }));
      localStorage.setItem(SUBS_KEY, JSON.stringify(marks));
    } catch {}
  }, [input, items, marks, restored]);

  const patch = useCallback((key: string, p: Partial<Item>) => {
    setItems((list) => list.map((it) => (it.key === key ? { ...it, ...p } : it)));
  }, []);

  function mark(sub: string, p: SubMarks[string]) {
    setMarks((m) => ({ ...m, [sub]: { ...m[sub], ...p } }));
  }

  /** The review threads already posted from the outreach account. */
  const loadMine = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch("/api/outreach/reviews/mine", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) return;
      const list = (json.threads ?? []) as Thread[];
      // Set the ref too, so a check straight after this sees them before the next render.
      threadsRef.current = list;
      setThreads(list);
    } catch {}
  }, []);

  /** Read every thread (and any pasted names) and add anyone new. */
  const check = useCallback(async (quiet = false) => {
    if (checking.current) return;
    const live = threadsRef.current.filter((t) => !t.removed).map((t) => t.url);
    const text = [inputRef.current.trim(), ...live].filter(Boolean).join("\n");
    if (!text) {
      if (!quiet) setError("Post a thread first, or paste a thread link or some Twitch names.");
      return;
    }
    checking.current = true;
    if (!quiet) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await fetch(`/api/outreach/reviews?input=${encodeURIComponent(text)}`);
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
      if (!quiet && entries.length === 0) setError("No replies yet. The mirror can be a few minutes behind Reddit, so check again soon.");
    } catch (err) {
      if (!quiet) setError(err instanceof Error ? err.message : "Couldn't read that.");
    } finally {
      checking.current = false;
      if (!quiet) setLoading(false);
    }
  }, []);

  // Find posted threads and read them on load, then again every few minutes while the page is open.
  useEffect(() => {
    void (async () => {
      await loadMine();
      if (threadsRef.current.some((t) => !t.removed)) await check(true);
    })();
    const timer = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      await loadMine();
      await check(true);
    }, RECHECK_MS);
    return () => clearInterval(timer);
  }, [loadMine, check]);

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
  const canCheck = !!input.trim() || threads.some((t) => !t.removed);

  return (
    <div className="card" style={{ marginBottom: 20, overflow: "hidden" }}>
      <div className="card-head">
        <h3>Review threads</h3>
        <div className="right">
          {items.length > 0 && (
            <span className="label-mono">
              {items.length} people · {toPost} to post{running ? ` · ${running} running` : ""} · {count("done")} posted
            </span>
          )}
        </div>
      </div>

      {/* Where to post. Open subs post in one click; the rest ask the mods first. */}
      <div className="card-pad" style={{ display: "grid", gap: 0, borderBottom: "1px solid var(--line)" }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
          <span className="mono-label">Post a review thread</span>
          <span style={{ fontSize: 11, color: "var(--ink-3)" }}>
            One sub a day is safest. The same post everywhere at once looks like spam to Reddit.
          </span>
        </div>
        {REVIEW_SUBS.map((s) => {
          const latest = threads.find((t) => t.sub === s.name);
          const m = marks[s.name] ?? {};
          const canPost = s.status === "open" || (s.status === "ask" && m.approved);
          const justOpened = !!m.opened && !latest && Date.now() - Date.parse(m.opened) < 60 * 60 * 1000;
          return (
            <div
              key={s.name}
              style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 12, alignItems: "center", padding: "9px 0", borderTop: "1px solid var(--line)" }}
            >
              <div style={{ minWidth: 0 }}>
                <div className="row gap-sm" style={{ alignItems: "baseline", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: s.status === "no" ? "var(--ink-3)" : "var(--ink)" }}>r/{s.name}</span>
                  <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                    {s.members}
                  </span>
                  {latest && (
                    <a
                      href={latest.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 12, color: latest.removed ? "#F87171" : "var(--ink-2)", textDecoration: "underline", textUnderlineOffset: 3 }}
                    >
                      {latest.removed
                        ? `Removed by the mods, ${ago(latest.created)}`
                        : `Posted ${ago(latest.created)} · ${latest.comments} comment${latest.comments === 1 ? "" : "s"}`}
                    </a>
                  )}
                </div>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--ink-3)", lineHeight: 1.5 }}>
                  {justOpened
                    ? "Posted it? It shows up here within a few minutes."
                    : s.status === "ask" && m.approved
                      ? "The mods said yes."
                      : s.status === "ask" && m.asked
                        ? `${s.rule} Asked the mods ${ago(Date.parse(m.asked) / 1000)}.`
                        : s.rule}
                </p>
              </div>
              <div className="row gap-sm" style={{ alignItems: "center" }}>
                {canPost && (
                  <a
                    href={submitUrl(s)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => mark(s.name, { opened: new Date().toISOString() })}
                    className={`btn ${latest ? "btn-ghost" : "btn-blue"}`}
                    style={smallBtn}
                  >
                    {latest ? "Post again" : "Post"}
                  </a>
                )}
                {s.status === "ask" && !m.approved && (
                  <>
                    {m.asked && (
                      <button onClick={() => mark(s.name, { approved: true })} style={linkBtn}>
                        They said yes
                      </button>
                    )}
                    <a
                      href={modmailUrl(s)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => mark(s.name, { asked: new Date().toISOString() })}
                      className="btn btn-ghost"
                      style={smallBtn}
                    >
                      {m.asked ? "Ask again" : "Ask mods"}
                    </a>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card-pad" style={{ display: "grid", gap: 10 }}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-3)", lineHeight: 1.55 }}>
          Everyone who replies to your threads with their Twitch name gets their free report and a reply written from it.
          Replies are checked every few minutes while this page is open. You post the replies yourself.
        </p>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Another thread's link, or Twitch names one per line (optional)"
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
            onClick={() => void check()}
            disabled={loading || !canCheck}
            className="btn btn-blue"
            style={{ fontSize: 12, padding: "7px 16px", opacity: loading || !canCheck ? 0.5 : 1 }}
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
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{it.author ? `u/${it.author}` : it.login}</span>
                {it.sub && (
                  <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                    r/{it.sub}
                  </span>
                )}
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
                <div className="row gap-sm" style={{ alignItems: "center", flexWrap: "wrap" }}>
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
