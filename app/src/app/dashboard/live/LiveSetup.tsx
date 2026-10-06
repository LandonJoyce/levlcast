"use client";

import { useEffect, useState } from "react";

/**
 * The streamer's private dock link: copy it into OBS, open it in a tab, or
 * replace it if it got out (the old one stops working at once).
 */
export default function LiveSetup() {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/live/dock", { cache: "no-store" });
        const json = await res.json();
        if (!alive) return;
        if (res.ok) setUrl(json.url);
        else setError(json.error ?? "Couldn't load your link.");
      } catch {
        if (alive) setError("Couldn't load your link. Refresh to try again.");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Couldn't copy. Select the link and copy it yourself.");
    }
  };

  const replace = async () => {
    if (!window.confirm("Make a new link? The old one stops working wherever you pasted it, so you'll need to paste the new one into OBS.")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/live/dock", { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setUrl(json.url);
        setError(null);
      } else {
        setError(json.error ?? "Couldn't make a new link.");
      }
    } catch {
      setError("Couldn't make a new link. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card card-pad lv-link">
      <h3>Your panel link</h3>
      <div className="lv-link-row">
        <input readOnly value={url ?? "Loading…"} onFocus={(e) => e.currentTarget.select()} aria-label="Your private panel link" />
        <button type="button" className="btn btn-blue" onClick={copy} disabled={!url}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="lv-link-more">
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer">
            Open it in a tab
          </a>
        )}
        <button type="button" onClick={replace} disabled={busy || !url}>
          {busy ? "Making a new link…" : "Make a new link"}
        </button>
      </div>
      <p className="lv-note">Keep it to yourself: anyone with this link can see your live numbers.</p>
      {error && <p className="lv-err">{error}</p>}
    </section>
  );
}
