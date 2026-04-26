"use client";

import { useState } from "react";
import { RegenerateClip } from "./clip-actions";

interface Props {
  clipId: string;
  vodId: string;
  startSeconds: number;
  title: string;
  category: string;
  timestamp: string;
}

export function FailedClipCard({ clipId, vodId, startSeconds, title, category, timestamp }: Props) {
  const [hidden, setHidden] = useState(false);
  const [queued, setQueued] = useState(false);

  if (hidden && !queued) return null;

  if (queued) {
    return (
      <div className="clip-card">
        <div className="clip-thumb" style={{ background: "color-mix(in oklab, var(--blue) 8%, var(--surface))" }}>
          <span className="ts">{timestamp}</span>
          <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
            <span className="mono" style={{ fontSize: 11, color: "var(--blue)", letterSpacing: ".06em" }}>generating…</span>
          </span>
        </div>
        <div className="clip-meta">
          <b>{title}</b>
          <span>{category}</span>
        </div>
        <div style={{ padding: "0 12px 12px" }}>
          <span className="chip" style={{ width: "100%", justifyContent: "center", color: "var(--blue)" }}>Processing…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="clip-card">
      <div className="clip-thumb" style={{ background: "color-mix(in oklab, var(--danger) 8%, var(--surface))" }}>
        <span className="ts">{timestamp}</span>
        <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
          <span className="mono" style={{ fontSize: 11, color: "var(--danger)", letterSpacing: ".06em" }}>failed</span>
        </span>
      </div>
      <div className="clip-meta">
        <b>{title}</b>
        <span>{category}</span>
      </div>
      <div style={{ padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
        <RegenerateClip
          clipId={clipId}
          vodId={vodId}
          startSeconds={startSeconds}
          onRegenerated={() => setQueued(true)}
        />
      </div>
    </div>
  );
}
