"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import "./add-to-obs.css";

/**
 * "Add to OBS": the Live panel in OBS in as few steps as OBS allows. OBS
 * has no way for a website to add a dock itself, so it's one click to copy
 * the streamer's private link and one paste into Docks > Custom Browser
 * Docks, with pictures of exactly where. Opened from the home page and the
 * account menu; /dashboard/live has the rest (phone voice, mic and scenes).
 */
export function AddToObsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const close = useRef(onClose);
  close.current = onClose;

  // The link, as soon as the window opens, so Copy works on the first click.
  useEffect(() => {
    if (!open || url) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/live/dock", { cache: "no-store" });
        const json = await res.json();
        if (!alive) return;
        if (res.ok) setUrl(json.url);
        else setError(json.error ?? "Couldn't get your link. Try again in a moment.");
      } catch {
        if (alive) setError("Couldn't get your link. Check your internet and try again.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, url]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close.current();
    document.addEventListener("keydown", onKey);
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = before;
    };
  }, [open]);

  if (!open) return null;

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setError(null);
    } catch {
      setError("Couldn't copy it. Select the link below and copy it yourself.");
    }
  };

  return (
    <div className="ato" role="dialog" aria-modal="true" aria-labelledby="ato-title" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ato-in">
        <button type="button" className="ato-x" onClick={onClose} aria-label="Close">
          <X size={18} strokeWidth={2} aria-hidden="true" />
        </button>
        <h2 id="ato-title">Add LevlCast to OBS</h2>
        <p className="ato-sub">A private panel inside OBS that coaches you while you stream. Your viewers never see it.</p>

        <ol className="ato-steps">
          <li>
            <p>Copy your link.</p>
            <div className="ato-copy">
              <button type="button" className="btn btn-blue" onClick={copy} disabled={!url}>
                {copied ? "Copied" : url ? "Copy link" : "Getting your link…"}
              </button>
              {url && <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Your private panel link" />}
            </div>
          </li>
          <li>
            <p>
              In OBS, click <b>Docks</b>, then <b>Custom Browser Docks</b>.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/live/obs-step-docks.webp" width={520} height={420} alt="The Docks menu in OBS, with Custom Browser Docks at the bottom" />
          </li>
          <li>
            <p>
              Type <b>LevlCast</b> as the name, paste your link next to it, and click <b>Apply</b>.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/live/obs-step-dialog.webp" width={680} height={227} alt="OBS's Custom Browser Docks window with LevlCast and the link filled in" />
          </li>
        </ol>

        <p className="ato-done">That&apos;s it. The panel opens in OBS, and you can drag it wherever you like.</p>
        {error && <p className="ato-err">{error}</p>}
        <Link href="/dashboard/live" className="ato-more" onClick={onClose}>
          More on the Live page: hear it on your phone, get mic and scene nudges
        </Link>
      </div>
    </div>
  );
}

/** A button that opens the window, for pages that are otherwise server-rendered. */
export function AddToObsButton({ className, children }: { className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {children}
      </button>
      <AddToObsModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/**
 * The home page's introduction to Live, for streamers who haven't used it
 * yet. Once the panel has been open during one of their streams it goes.
 */
export function LivePromo() {
  return (
    <section className="obs-promo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/live/levlcast-in-obs.webp" width={1600} height={900} alt="The LevlCast panel docked on the right side of OBS during a stream" />
      <div className="obs-promo-text">
        <h2>A coach inside OBS while you stream</h2>
        <p>
          It sits next to your stream and tells you when you go quiet and who just showed up. On Pro it listens too, and tells
          you when chat asked something you missed. Only you can see it.
        </p>
        <div className="obs-promo-actions">
          <AddToObsButton className="btn btn-blue">Add to OBS</AddToObsButton>
          <Link href="/dashboard/live" className="obs-promo-link">
            How it works
          </Link>
        </div>
      </div>
    </section>
  );
}
