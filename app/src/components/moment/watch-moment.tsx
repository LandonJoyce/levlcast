"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, X } from "lucide-react";
import { clock, twitchEmbedAt, twitchVodAt, TWITCH_SHORTEST_KEEP_DAYS } from "@/lib/moment-time";

/*
 * Watch a moment without leaving the report. Every time in a report used
 * to be a link out to twitch.tv, which dropped the streamer on Twitch's
 * site at the exact point we were showing them what happened. This plays
 * the past broadcast right here, from a few seconds before the moment.
 */

/** Seconds of run-up before the moment, so it doesn't start mid-sentence. */
const LEAD_IN = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export function WatchMoment({
  vodId,
  seconds,
  label,
  streamDate,
  className,
  style,
  children,
}: {
  vodId: string;
  seconds: number;
  /** What the moment is, for the player's heading ("Best moment"). */
  label?: string;
  /** When the stream happened, to explain a player Twitch can't fill. */
  streamDate?: string | null;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`wm-trigger${className ? ` ${className}` : ""}`}
        style={style}
        onClick={() => setOpen(true)}
        aria-label={label ? `Watch ${label}, ${clock(seconds)}` : `Watch the moment at ${clock(seconds)}`}
        title={`Watch ${clock(seconds)}`}
      >
        {children}
      </button>
      {/* On the body, not here: a time can sit inside a paragraph, and the
          page's own layout shouldn't clip or restyle the player. */}
      {open &&
        createPortal(
          <MomentPlayer
            vodId={vodId}
            seconds={seconds}
            label={label}
            streamDate={streamDate}
            onClose={() => {
              setOpen(false);
              triggerRef.current?.focus();
            }}
          />,
          document.body
        )}
    </>
  );
}

export interface Moment {
  vodId: string;
  seconds: number;
  label?: string;
  streamDate?: string | null;
}

/**
 * The same player, opened from code instead of a button: the replay opens
 * it at whatever minute it's showing. Null keeps it closed.
 */
export function MomentDialog({ moment, onClose }: { moment: Moment | null; onClose: () => void }) {
  if (!moment) return null;
  return createPortal(<MomentPlayer {...moment} onClose={onClose} />, document.body);
}

function MomentPlayer({
  vodId,
  seconds,
  label,
  streamDate,
  onClose,
}: {
  vodId: string;
  seconds: number;
  label?: string;
  streamDate?: string | null;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [host, setHost] = useState<string | null>(null);
  // The latest onClose without re-running the setup below: the report page
  // refreshes itself while a clip renders, and each refresh hands down a
  // new function, which would pull focus off the player every few seconds.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    setHost(window.location.hostname);
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, []);

  const start = Math.max(0, seconds - LEAD_IN);
  const old = streamDate ? Date.now() - new Date(streamDate).getTime() > TWITCH_SHORTEST_KEEP_DAYS * DAY_MS : false;

  return (
    <div
      className="wm"
      role="dialog"
      aria-modal="true"
      aria-label={label ? `${label} at ${clock(seconds)}` : `The moment at ${clock(seconds)}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="wm-card">
        <div className="wm-head">
          <p className="wm-title">
            {label && <span>{label}</span>}
            <span className="wm-time">{clock(seconds)}</span>
          </p>
          <button ref={closeRef} type="button" className="wm-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="wm-player">
          {host && (
            <iframe
              src={twitchEmbedAt(vodId, start, host)}
              title="Twitch player"
              allow="autoplay; fullscreen"
              allowFullScreen
            />
          )}
        </div>
        <div className="wm-foot">
          {old ? (
            <p className="wm-note">
              Twitch deletes past broadcasts after 7 days on most channels (14 for Affiliates, 60 for Partners). If it
              won&apos;t play, this stream is gone from Twitch. Clips you made in LevlCast stay.
            </p>
          ) : (
            <span />
          )}
          <a href={twitchVodAt(vodId, start)} target="_blank" rel="noopener noreferrer" className="wm-out">
            Open on Twitch <ArrowUpRight size={12} aria-hidden="true" />
          </a>
        </div>
      </div>
    </div>
  );
}
