"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface UnpostedClip {
  id: string;
  title: string | null;
  peak_category: string | null;
}

interface Props {
  clips: UnpostedClip[];
  isYouTubeConnected: boolean;
}

function categoryChipClass(c: string): string {
  switch (c) {
    case "hype":        return "m";
    case "funny":       return "w";
    case "emotional":   return "r";
    case "educational": return "b";
    case "clutch":      return "g";
    default:            return "";
  }
}

function categoryLabel(c: string): string {
  if (c === "funny") return "COMEDY";
  return c.toUpperCase();
}

export function UnpostedClipsCard({ clips, isYouTubeConnected }: Props) {
  const router = useRouter();
  const [posting, setPosting] = useState<Record<string, "loading" | "done" | "error">>({});

  async function post(clipId: string) {
    setPosting((p) => ({ ...p, [clipId]: "loading" }));
    try {
      const res = await fetch("/api/youtube/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clipId }),
      });
      if (!res.ok) throw new Error();
      setPosting((p) => ({ ...p, [clipId]: "done" }));
      router.refresh();
    } catch {
      setPosting((p) => ({ ...p, [clipId]: "error" }));
    }
  }

  const shown = clips.slice(0, 3);

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div className="card-head">
        <div>
          <h3 style={{ margin: 0 }}>Ready to post</h3>
          <span className="label-mono" style={{ marginTop: 2, display: "block" }}>
            {clips.length} clip{clips.length !== 1 ? "s" : ""} waiting
          </span>
        </div>
        <Link href="/dashboard/clips?tab=ready" className="btn-link mono" style={{ fontSize: 11, letterSpacing: ".06em" }}>
          SEE ALL
        </Link>
      </div>

      {!isYouTubeConnected ? (
        <div style={{ padding: "14px 20px", borderTop: "1px solid var(--line)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span style={{ fontSize: 13.5, color: "var(--ink-2)" }}>
              Connect YouTube to post these clips as Shorts.
            </span>
            <Link href="/dashboard/connections" className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 12, flexShrink: 0 }}>
              Connect
            </Link>
          </div>
        </div>
      ) : (
        <div>
          {shown.map((clip, i) => {
            const state = posting[clip.id];
            const cat = clip.peak_category ?? "hype";
            return (
              <div
                key={clip.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 20px",
                  borderTop: i === 0 ? "1px solid var(--line)" : undefined,
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <span className={`chip ${categoryChipClass(cat)}`} style={{ flexShrink: 0, fontSize: 10 }}>
                    {categoryLabel(cat)}
                  </span>
                  <span style={{ fontSize: 13.5, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {clip.title || "Untitled clip"}
                  </span>
                </div>

                {state === "done" ? (
                  <span style={{ fontSize: 12, color: "var(--green)", fontWeight: 600, flexShrink: 0 }}>Posted</span>
                ) : state === "error" ? (
                  <button
                    onClick={() => post(clip.id)}
                    style={{ fontSize: 12, color: "var(--danger)", background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}
                  >
                    Retry
                  </button>
                ) : (
                  <button
                    onClick={() => post(clip.id)}
                    disabled={state === "loading"}
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "5px 12px",
                      borderRadius: 7,
                      border: "1px solid color-mix(in oklab, var(--blue) 40%, var(--line))",
                      background: "color-mix(in oklab, var(--blue) 10%, transparent)",
                      color: state === "loading" ? "var(--ink-3)" : "var(--blue)",
                      cursor: state === "loading" ? "default" : "pointer",
                      flexShrink: 0,
                    }}
                  >
                    {state === "loading" ? "Posting..." : "Post to YouTube"}
                  </button>
                )}
              </div>
            );
          })}

          {clips.length > 3 && (
            <div style={{ padding: "10px 20px" }}>
              <Link href="/dashboard/clips?tab=ready" style={{ fontSize: 12, color: "var(--ink-3)" }}>
                +{clips.length - 3} more clips
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
