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

/** A clip that didn't render, on the Clips page. Retrying hides the card. */
export function FailedClipCard({ clipId, vodId, startSeconds, title, category, timestamp }: Props) {
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  return (
    <div className="cl-card" data-failed="yes">
      <div className="cl-thumb">
        <span className="cl-making">Didn&apos;t render</span>
        <span className="cl-len">{timestamp}</span>
      </div>
      <div className="cl-body">
        <p className="cl-title">{title}</p>
        <p className="cl-from">{category}</p>
        <div className="cl-retry">
          <RegenerateClip clipId={clipId} vodId={vodId} startSeconds={startSeconds} onRegenerated={() => setHidden(true)} />
        </div>
      </div>
    </div>
  );
}
