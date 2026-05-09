"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CaptionCard, CaptionStyle } from "@/lib/captions";

const STYLE_OPTIONS: { value: CaptionStyle; label: string }[] = [
  { value: "bold", label: "Bold" },
  { value: "boxed", label: "Boxed" },
  { value: "minimal", label: "Minimal" },
  { value: "classic", label: "Classic" },
  { value: "neon", label: "Neon" },
  { value: "fire", label: "Fire" },
  { value: "impact", label: "Impact" },
];

function fmt(t: number): string {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const ds = Math.floor((t - Math.floor(t)) * 10);
  return `${m}:${String(s).padStart(2, "0")}.${ds}`;
}

export function ClipEditor({
  clipId,
  videoUrl,
  capturedThumbnailUrl,
  candidateFrames,
  fullDuration,
  defaultCards,
  captionStyle,
  isReel,
}: {
  clipId: string;
  videoUrl: string;
  capturedThumbnailUrl: string | null;
  candidateFrames: string[];
  fullDuration: number;
  defaultCards: CaptionCard[];
  captionStyle: CaptionStyle;
  /** Reels keep a fixed visual style — the dropdown is hidden for them. */
  isReel: boolean;
  title: string;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(fullDuration);
  const [cards, setCards] = useState<CaptionCard[]>(defaultCards);
  const [style, setStyle] = useState<CaptionStyle>(captionStyle);
  const [frames, setFrames] = useState<string[]>(candidateFrames);
  const [framesLoading, setFramesLoading] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(capturedThumbnailUrl);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep playback inside the trimmed window so the streamer can preview
  // exactly what the exported clip will look like. Loops back to trimStart
  // when it crosses trimEnd.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => {
      if (video.currentTime > trimEnd) {
        video.currentTime = trimStart;
      }
    };
    video.addEventListener("timeupdate", onTime);
    return () => video.removeEventListener("timeupdate", onTime);
  }, [trimStart, trimEnd]);

  function setStartHere() {
    const t = videoRef.current?.currentTime ?? trimStart;
    setTrimStart(Math.min(Math.max(0, t), trimEnd - 1));
  }
  function setEndHere() {
    const t = videoRef.current?.currentTime ?? trimEnd;
    setTrimEnd(Math.max(Math.min(fullDuration, t), trimStart + 1));
  }
  function jumpTo(t: number) {
    if (videoRef.current) {
      videoRef.current.currentTime = t;
      videoRef.current.play().catch(() => {});
    }
  }

  async function loadFrames() {
    if (frames.length === 4) return;
    setFramesLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clips/${clipId}/frames`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to extract frames");
        return;
      }
      setFrames(json.frames as string[]);
    } catch {
      setError("Network error extracting frames");
    } finally {
      setFramesLoading(false);
    }
  }

  function updateCardText(idx: number, text: string) {
    setCards((prev) => prev.map((c, i) => (i === idx ? { ...c, text } : c)));
  }
  function deleteCard(idx: number) {
    setCards((prev) => prev.filter((_, i) => i !== idx));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/clips/${clipId}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trimStart,
          trimEnd,
          editedCaptions: cards,
          captionStyle: style,
          thumbnailUrl,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Save failed");
        return;
      }
      router.push("/dashboard/clips");
      router.refresh();
    } catch {
      setError("Network error saving edit");
    } finally {
      setSaving(false);
    }
  }

  const trimDuration = Math.max(0, trimEnd - trimStart);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24 }}>
      {/* LEFT — preview + trim */}
      <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          preload="metadata"
          playsInline
          style={{ width: "100%", aspectRatio: "16/9", maxHeight: "min(50vh, 380px)", background: "#000", borderRadius: 10, objectFit: "contain" }}
        />

        {/* Trim section */}
        <div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>
              Trim
            </p>
            <p className="mono" style={{ fontSize: 11, color: "var(--ink-3)", margin: 0 }}>
              {fmt(trimStart)} → {fmt(trimEnd)} · {trimDuration.toFixed(1)}s
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <label className="mono" style={{ fontSize: 11, color: "var(--ink-3)", minWidth: 38 }}>Start</label>
              <input
                type="range"
                min={0}
                max={fullDuration}
                step={0.1}
                value={trimStart}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setTrimStart(Math.min(v, trimEnd - 1));
                }}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={setStartHere}
                className="btn btn-ghost"
                style={{ fontSize: 11, padding: "5px 10px", whiteSpace: "nowrap" }}
                title="Set start to current playback position"
              >
                Mark here
              </button>
              <button
                type="button"
                onClick={() => jumpTo(trimStart)}
                className="btn btn-ghost"
                style={{ fontSize: 11, padding: "5px 10px" }}
              >
                Preview
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <label className="mono" style={{ fontSize: 11, color: "var(--ink-3)", minWidth: 38 }}>End</label>
              <input
                type="range"
                min={0}
                max={fullDuration}
                step={0.1}
                value={trimEnd}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setTrimEnd(Math.max(v, trimStart + 1));
                }}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={setEndHere}
                className="btn btn-ghost"
                style={{ fontSize: 11, padding: "5px 10px", whiteSpace: "nowrap" }}
                title="Set end to current playback position"
              >
                Mark here
              </button>
              <button
                type="button"
                onClick={() => jumpTo(Math.max(0, trimEnd - 2))}
                className="btn btn-ghost"
                style={{ fontSize: 11, padding: "5px 10px" }}
              >
                Preview
              </button>
            </div>
          </div>
        </div>

        {/* Hook frame picker */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>
              Hook frame
            </p>
            {frames.length === 0 && !framesLoading && (
              <button
                type="button"
                onClick={loadFrames}
                className="btn btn-ghost"
                style={{ fontSize: 11, padding: "5px 10px" }}
              >
                Load options
              </button>
            )}
          </div>
          {framesLoading ? (
            <p style={{ fontSize: 12, color: "var(--ink-3)", margin: 0 }}>Pulling frames…</p>
          ) : frames.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--ink-3)", margin: 0 }}>
              Click "Load options" to grab four candidate thumbnails from the clip.
            </p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {frames.map((url) => {
                const selected = thumbnailUrl === url;
                return (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setThumbnailUrl(url)}
                    style={{
                      padding: 0,
                      border: selected ? "2px solid var(--blue)" : "1px solid var(--line)",
                      borderRadius: 6,
                      overflow: "hidden",
                      cursor: "pointer",
                      background: "var(--surface-2)",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="frame" style={{ width: "100%", display: "block", aspectRatio: "16/9", objectFit: "cover" }} />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT — captions + style + actions */}
      <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 16, alignSelf: "start", position: "sticky", top: 16 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 8px" }}>
            Caption style
          </p>
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value as CaptionStyle)}
            className="select"
            style={{ width: "100%", fontSize: 13, padding: "8px 10px", background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--ink)" }}
          >
            {STYLE_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div style={{ flex: 1, minHeight: 0 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 8px" }}>
            Captions ({cards.length})
          </p>
          <div style={{ maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, paddingRight: 4 }}>
            {cards.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--ink-3)", margin: 0 }}>
                No caption cards. The clip will export silent (no captions).
              </p>
            ) : (
              cards.map((c, i) => {
                const inWindow = c.end > trimStart && c.start < trimEnd;
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex", flexDirection: "column", gap: 4,
                      padding: "6px 8px",
                      background: inWindow ? "var(--surface-2)" : "color-mix(in oklab, var(--surface-2) 60%, transparent)",
                      border: "1px solid var(--line)",
                      borderRadius: 6,
                      opacity: inWindow ? 1 : 0.45,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>
                        {fmt(c.start)}
                      </span>
                      <input
                        type="text"
                        value={c.text}
                        onChange={(e) => updateCardText(i, e.target.value)}
                        style={{
                          flex: 1,
                          fontSize: 12.5,
                          padding: "4px 6px",
                          background: "var(--surface)",
                          border: "1px solid var(--line)",
                          borderRadius: 4,
                          color: "var(--ink)",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => deleteCard(i)}
                        className="btn btn-ghost"
                        style={{ fontSize: 10, padding: "3px 7px", whiteSpace: "nowrap" }}
                      >
                        Drop
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {error && (
            <p className="mono" style={{ fontSize: 11, color: "var(--danger)", margin: 0 }}>{error}</p>
          )}
          <button
            type="button"
            onClick={save}
            disabled={saving || trimDuration < 2}
            className="btn btn-blue"
            style={{ width: "100%", justifyContent: "center", fontSize: 13, padding: "10px 0", opacity: saving || trimDuration < 2 ? 0.6 : 1 }}
          >
            {saving ? "Re-exporting…" : "Save edit"}
          </button>
          <p style={{ fontSize: 11, color: "var(--ink-3)", margin: 0, textAlign: "center" }}>
            Re-edits don't cost a clip.
          </p>
        </div>
      </div>
    </div>
  );
}
