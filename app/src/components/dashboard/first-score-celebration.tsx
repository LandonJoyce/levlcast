"use client";

import { useEffect, useState } from "react";
import { Check, Link as LinkIcon, X } from "lucide-react";
import { rankFromPoints, TIER_HEX } from "@/lib/rank";

/**
 * The first report is a placement: it puts the streamer on the ladder.
 * This is the one time the app interrupts, so it makes the most of it.
 * The emblem lands, the tier is said out loud, and the share buttons are
 * right there while it still feels like news.
 */

const KEY = "levlcast_first_score_seen";
const SITE = "https://www.levlcast.com";

function reactionLine(score: number): string {
  if (score >= 85) return "Cooking. Stream's clicking.";
  if (score >= 70) return "Honest read. Going to apply this next stream.";
  if (score >= 55) return "Fair take. Lots to fix but the path is clear.";
  if (score >= 40) return "Tough love but specific. Better than 'just stream more'.";
  return "AI cooked me but at least it was specific. Next stream's going to hit different.";
}

function trimForTweet(text: string, max = 140): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= max) return collapsed;
  const cut = collapsed.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 60 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:!?\-]$/, "");
}

function buildTweet(url: string, score: number, rank: string | null, fix: string | null): string {
  const lines = [
    rank ? `Placed ${rank} on my first LevlCast report. ${score}/100.` : `${score}/100 on my stream coach report.`,
    "",
    reactionLine(score),
  ];
  if (fix && fix.trim().length > 0) {
    lines.push("");
    lines.push(`Biggest takeaway: ${trimForTweet(fix, 140)}`);
  }
  lines.push("");
  lines.push("Get yours free:");
  const text = lines.join("\n");
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}

function XIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
}

interface Props {
  vodId: string;
  score: number;
  /** Rank points after this stream: the placement. */
  points?: number | null;
  /** The one thing to do next stream. */
  recommendation?: string | null;
  existingToken?: string | null;
}

export function FirstScoreCelebration({ vodId, score, points = null, recommendation, existingToken }: Props) {
  const [visible, setVisible] = useState(false);
  const [url, setUrl] = useState<string | null>(existingToken ? `${SITE}/share/${existingToken}` : null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setVisible(true);
    } catch {
      // No storage, no popup. The report is still right there.
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  function dismiss() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
    setVisible(false);
  }

  async function ensureLink(): Promise<string | null> {
    if (url) return url;
    setLoading(true);
    try {
      const res = await fetch(`/api/vods/${vodId}/share`, { method: "POST" });
      const json = await res.json();
      if (res.ok && json.url) {
        setUrl(json.url);
        return json.url;
      }
      return null;
    } finally {
      setLoading(false);
    }
  }

  const rank = points !== null ? rankFromPoints(points) : null;

  async function shareToX() {
    const link = await ensureLink();
    if (!link) return;
    window.open(buildTweet(link, score, rank?.label ?? null, recommendation ?? null), "_blank", "noopener,noreferrer");
  }

  async function copyLink() {
    const link = await ensureLink();
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  if (!visible) return null;

  return (
    <div className="fs" role="dialog" aria-modal="true" aria-labelledby="fs-title">
      <div className="fs-scrim" onClick={dismiss} />
      <div className="fs-card" style={rank ? { ["--tier" as string]: TIER_HEX[rank.tier] ?? "#fff" } : undefined}>
        <button type="button" className="fs-close" onClick={dismiss} aria-label="Close">
          <X size={16} aria-hidden="true" />
        </button>

        <p className="fs-k">Your first report is in</p>
        {rank ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="fs-emb" src={`/ranks/${rank.tier.toLowerCase()}.png`} alt="" width={384} height={384} />
            <h2 id="fs-title" className="fs-title">
              You placed in <span>{rank.label}</span>
            </h2>
            <p className="fs-sub">
              Score {score} · {points!.toLocaleString("en-US")} points. Every stream you analyze from here moves you up
              or down.
            </p>
          </>
        ) : (
          <>
            <h2 id="fs-title" className="fs-title">
              <span className="fs-score">{score}</span> out of 100
            </h2>
            <p className="fs-sub">Every stream you analyze from here gets compared to this one.</p>
          </>
        )}

        {recommendation && (
          <div className="fs-fix">
            <p className="fs-k">Do this next stream</p>
            <p>{recommendation}</p>
          </div>
        )}

        <div className="fs-actions">
          <button type="button" className="btn btn-blue" onClick={shareToX} disabled={loading}>
            <XIcon size={13} />
            {loading ? "Making a link..." : "Share to X"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={copyLink} disabled={loading}>
            {copied ? <Check size={14} aria-hidden="true" /> : <LinkIcon size={14} aria-hidden="true" />}
            {copied ? "Link copied" : "Copy link"}
          </button>
        </div>
        <button type="button" className="fs-later" onClick={dismiss}>
          Maybe later
        </button>
      </div>
    </div>
  );
}
