"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CaptionCard, CaptionStyle } from "@/lib/captions";
import { UpgradeModal } from "@/components/dashboard/upgrade-modal";

/**
 * Card with a stable identity assigned in the editor for React key purposes.
 * The `id` is local-only — saving sends just {start, end, text} to the API.
 */
type EditorCard = CaptionCard & { id: string };
let cardSeq = 0;
function nextCardId(): string {
  cardSeq += 1;
  return `card_${cardSeq}_${Date.now()}`;
}

// Sample positions used by the frame extraction endpoint. Mirrored here so
// we can show a timestamp under each candidate thumbnail without doing
// another round-trip.
const FRAME_POSITIONS = [0.1, 0.35, 0.65, 0.9] as const;

// Each style includes a tiny preview letter rendered with the same visual
// treatment the FFmpeg drawtext filter uses, so streamers can see what the
// caption will actually look like before they pick it.
const STYLE_OPTIONS: {
  value: CaptionStyle;
  label: string;
  preview: React.ReactNode;
}[] = [
  {
    value: "bold",
    label: "Bold",
    preview: <span style={{ fontWeight: 900, fontSize: 18, color: "#fff", textTransform: "uppercase", textShadow: "-2px -2px 0 #000,2px -2px 0 #000,-2px 2px 0 #000,2px 2px 0 #000", letterSpacing: ".02em", lineHeight: 1 }}>Aa</span>,
  },
  {
    value: "boxed",
    label: "Boxed",
    preview: <span style={{ fontWeight: 700, fontSize: 13, color: "#fff", textTransform: "uppercase", background: "rgba(0,0,0,0.7)", padding: "3px 7px", borderRadius: 4, letterSpacing: ".02em" }}>Aa</span>,
  },
  {
    value: "minimal",
    label: "Minimal",
    preview: <span style={{ fontWeight: 500, fontSize: 14, color: "rgba(255,255,255,0.92)", textShadow: "-1px -1px 0 rgba(0,0,0,0.8),1px 1px 0 rgba(0,0,0,0.8)" }}>Aa</span>,
  },
  {
    value: "classic",
    label: "Classic",
    preview: <span style={{ fontWeight: 900, fontSize: 18, color: "#FFE600", textTransform: "uppercase", textShadow: "-2px -2px 0 #000,2px -2px 0 #000,-2px 2px 0 #000,2px 2px 0 #000", letterSpacing: ".02em" }}>Aa</span>,
  },
  {
    value: "neon",
    label: "Neon",
    preview: <span style={{ fontWeight: 900, fontSize: 18, color: "#00EEFF", textTransform: "uppercase", textShadow: "-1px -1px 0 #003344,1px -1px 0 #003344,-1px 1px 0 #003344,1px 1px 0 #003344,0 0 10px rgba(0,238,255,0.6)", letterSpacing: ".02em" }}>Aa</span>,
  },
  {
    value: "fire",
    label: "Fire",
    preview: <span style={{ fontWeight: 900, fontSize: 18, color: "#FF6B00", textTransform: "uppercase", textShadow: "-2px -2px 0 #1A0000,2px -2px 0 #1A0000,-2px 2px 0 #1A0000,2px 2px 0 #1A0000,0 0 10px rgba(255,107,0,0.5)", letterSpacing: ".02em" }}>Aa</span>,
  },
  {
    value: "impact",
    label: "Impact",
    preview: <span style={{ fontWeight: 900, fontSize: 22, color: "#fff", textTransform: "uppercase", textShadow: "-3px -3px 0 #000,3px -3px 0 #000,-3px 3px 0 #000,3px 3px 0 #000", letterSpacing: "-.01em", lineHeight: 1 }}>Aa</span>,
  },
];

type StreamLayout = "no_cam" | "cam_br" | "cam_bl" | "cam_tr" | "cam_tl";
const LAYOUT_OPTIONS: { value: StreamLayout; label: string }[] = [
  { value: "no_cam", label: "No facecam (gameplay only)" },
  { value: "cam_br", label: "Cam bottom-right" },
  { value: "cam_bl", label: "Cam bottom-left" },
  { value: "cam_tr", label: "Cam top-right" },
  { value: "cam_tl", label: "Cam top-left" },
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
  isPro,
  isYouTubeConnected,
  hasOriginal,
}: {
  clipId: string;
  videoUrl: string;
  capturedThumbnailUrl: string | null;
  candidateFrames: string[];
  fullDuration: number;
  defaultCards: CaptionCard[];
  captionStyle: CaptionStyle;
  isPro: boolean;
  isYouTubeConnected: boolean;
  isReel: boolean;
  /** True when an original_* snapshot exists (i.e. clip has been edited at least once). */
  hasOriginal: boolean;
  title: string;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(fullDuration);
  // Map default cards to editor cards once on mount. Cards from the server
  // don't carry a stable id; we mint one so React keys are deletion-safe.
  const initialCards = useMemo<EditorCard[]>(
    () => defaultCards.map((c) => ({ ...c, id: nextCardId() })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const [cards, setCards] = useState<EditorCard[]>(initialCards);
  const [style, setStyle] = useState<CaptionStyle>(captionStyle);
  const [frames, setFrames] = useState<string[]>(candidateFrames);
  const [framesLoading, setFramesLoading] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(capturedThumbnailUrl);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressNote, setProgressNote] = useState<string | null>(null);
  // Sticks around after saving=false so the user has visible confirmation
  // that "Save & ship it" actually did something. Auto-clears on next click.
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  // Format & destination state — drive the post-save export flow.
  const [format, setFormat] = useState<"horizontal" | "vertical">("horizontal");
  const [layout, setLayout] = useState<StreamLayout>("no_cam");
  const [doDownload, setDoDownload] = useState(true);
  const [doYouTube, setDoYouTube] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState<string | null>(null);
  const [reverting, setReverting] = useState(false);
  // Set after save completes when the user picked Download. Rendered as a
  // real <a> the user clicks themselves — bypasses popup blockers and
  // avoids about:blank from a streaming mp4 response opened in a new tab.
  const [readyDownload, setReadyDownload] = useState<{ url: string; label: string } | null>(null);

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

  // Hard cap to match the server-side cap so users can't paste a paragraph
  // and have it silently truncated only at save time.
  const MAX_CAPTION_CHARS = 60;

  function updateCardText(id: string, text: string) {
    const capped = text.slice(0, MAX_CAPTION_CHARS);
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, text: capped } : c)));
  }
  function deleteCard(id: string) {
    const card = cards.find((c) => c.id === id);
    const preview = card ? card.text.slice(0, 40) : "this caption";
    if (!window.confirm(`Drop "${preview}"? You can't undo this without re-loading the page.`)) return;
    setCards((prev) => prev.filter((c) => c.id !== id));
  }
  /**
   * Insert a new caption card at the current playback position. Default
   * length is 1.4s (matches the auto-grouping target in lib/captions.ts).
   * The user can then type the line and drag the card around in time later
   * if we add timing handles.
   */
  function addCard() {
    const t = videoRef.current?.currentTime ?? trimStart;
    const start = Math.max(trimStart, Math.min(t, trimEnd - 0.4));
    const end = Math.min(trimEnd, start + 1.4);
    if (end - start < 0.3) return;
    setCards((prev) => {
      const next = [...prev, { id: nextCardId(), start, end, text: "" }];
      next.sort((a, b) => a.start - b.start);
      return next;
    });
  }

  async function revertToOriginal() {
    if (!window.confirm("Revert this clip to the auto-generated original? Your trim, caption edits, and hook frame will be discarded.")) return;
    setReverting(true);
    setError(null);
    try {
      const res = await fetch(`/api/clips/${clipId}/revert`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Revert failed");
        return;
      }
      // Reload so the editor re-mounts with the restored values from the
      // server. Avoids the stale-state hazard of trying to merge in client.
      router.refresh();
      setSavedFlash("Reverted to original");
    } catch {
      setError("Network error during revert");
    } finally {
      setReverting(false);
    }
  }

  async function saveAndShip() {
    // Format/destination guards — show paywall instead of silently failing.
    if (format === "vertical" && !isPro) {
      setUpgradeReason("9:16 vertical export is a Pro feature. Upgrade to send clips straight to TikTok and Shorts.");
      setUpgradeOpen(true);
      return;
    }
    if (doYouTube && !isPro) {
      setUpgradeReason("Posting to YouTube is a Pro feature. Upgrade to publish clips directly from LevlCast.");
      setUpgradeOpen(true);
      return;
    }
    if (doYouTube && !isYouTubeConnected) {
      setError("Connect YouTube in Settings before posting.");
      return;
    }
    if (!doDownload && !doYouTube) {
      setError("Pick at least one destination — download or YouTube.");
      return;
    }

    setSaving(true);
    setError(null);
    setYoutubeUrl(null);
    setSavedFlash(null);
    setReadyDownload(null);
    setProgressNote("Saving your edits...");

    try {
      // Step 1 — save edits (re-cuts the horizontal clip with trim + captions
      // + thumbnail). Always runs.
      const editRes = await fetch(`/api/clips/${clipId}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trimStart,
          trimEnd,
          // Drop the local-only `id` field — server expects bare CaptionCards.
          editedCaptions: cards.map(({ start, end, text }) => ({ start, end, text })),
          captionStyle: style,
          thumbnailUrl,
        }),
      });
      const editJson = await editRes.json();
      if (!editRes.ok) {
        setError(editJson.error || "Save failed");
        return;
      }

      // Step 2 — set up destinations. We render a real <a download> for the
      // download instead of programmatic window.open() because:
      //   1) the user gesture is gone after the edit-save await, so Firefox
      //      and Safari pop-up blockers reject window.open()
      //   2) the export endpoint streams an mp4 — opening it as a tab shows
      //      about:blank while the download buffers
      // The clickable link below the success message handles both cleanly.
      if (doDownload) {
        const url = format === "vertical"
          ? `/api/clips/${clipId}/export?layout=${layout}`
          : `/api/clips/${clipId}/download`;
        const label = format === "vertical" ? "Download 9:16 vertical" : "Download 16:9";
        setReadyDownload({ url, label });
      }

      if (doYouTube) {
        setProgressNote("Posting to YouTube...");
        const ytRes = await fetch("/api/youtube/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clipId }),
        });
        const ytJson = await ytRes.json();
        if (!ytRes.ok) {
          setError(`Saved your edits but YouTube post failed: ${ytJson.error || "unknown error"}`);
          return;
        }
        if (ytJson.url) setYoutubeUrl(ytJson.url);
      }

      // Build a destination summary so the success flash actually tells the
      // user what happened.
      const parts: string[] = ["Saved"];
      if (doDownload) parts.push("download ready below");
      if (doYouTube) parts.push("posted to YouTube");
      setSavedFlash(parts.join(" · "));
      setProgressNote(null);
      router.refresh();
    } catch {
      setError("Network error during ship");
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
              {frames.map((url, i) => {
                const selected = thumbnailUrl === url;
                // Server samples at 10 / 35 / 65 / 90 percent of the clip's
                // total duration; show the actual time so the streamer can
                // map a thumbnail to a moment without playing through.
                const pct = FRAME_POSITIONS[i] ?? 0;
                const t = fullDuration * pct;
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
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Frame at ${fmt(t)}`} style={{ width: "100%", display: "block", aspectRatio: "16/9", objectFit: "cover" }} />
                    <span
                      className="mono"
                      style={{
                        fontSize: 10,
                        color: selected ? "var(--blue)" : "var(--ink-3)",
                        padding: "3px 0 4px",
                        textAlign: "center",
                      }}
                    >
                      {fmt(t)}
                    </span>
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
            {STYLE_OPTIONS.map((s) => {
              const active = style === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStyle(s.value)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                    padding: "8px 10px",
                    background: active ? "color-mix(in oklab, var(--blue) 18%, var(--surface-2))" : "var(--surface-2)",
                    border: `1px solid ${active ? "var(--blue)" : "var(--line)"}`,
                    borderRadius: 8,
                    cursor: "pointer",
                    color: active ? "var(--blue)" : "var(--ink)",
                    fontSize: 12, fontWeight: 600,
                    minHeight: 38,
                  }}
                >
                  <span>{s.label}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 32 }}>
                    {s.preview}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>
              Captions ({cards.length})
            </p>
            <button
              type="button"
              onClick={addCard}
              className="btn btn-ghost"
              style={{ fontSize: 11, padding: "4px 9px" }}
              title="Add a caption at the current playback position"
            >
              + Add
            </button>
          </div>
          <div style={{ maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, paddingRight: 4 }}>
            {cards.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--ink-3)", margin: 0 }}>
                No caption cards. Click + Add to write one at the current playback time, or the clip will export silent.
              </p>
            ) : (
              cards.map((c) => {
                const inWindow = c.end > trimStart && c.start < trimEnd;
                return (
                  <div
                    key={c.id}
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
                        maxLength={MAX_CAPTION_CHARS}
                        placeholder={c.text === "" ? "Type the line..." : undefined}
                        onChange={(e) => updateCardText(c.id, e.target.value)}
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
                        onClick={() => deleteCard(c.id)}
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

        {/* Format & destination — combines what used to be three different
            buttons (Edit / Make Vertical / Post to YouTube) into one save-
            and-ship flow so users don't have to know which button does what. */}
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>
            Format
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            {(["horizontal", "vertical"] as const).map((f) => {
              const active = format === f;
              const label = f === "horizontal" ? "16:9 Horizontal" : "9:16 Vertical";
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  style={{
                    flex: 1,
                    padding: "9px 10px",
                    fontSize: 12, fontWeight: 600,
                    background: active ? "color-mix(in oklab, var(--blue) 18%, var(--surface-2))" : "var(--surface-2)",
                    border: `1px solid ${active ? "var(--blue)" : "var(--line)"}`,
                    borderRadius: 8,
                    color: active ? "var(--blue)" : "var(--ink)",
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {format === "vertical" && (
            <div>
              <p style={{ fontSize: 11, color: "var(--ink-3)", margin: "0 0 6px" }}>Layout</p>
              <select
                value={layout}
                onChange={(e) => setLayout(e.target.value as StreamLayout)}
                style={{ width: "100%", fontSize: 12.5, padding: "7px 9px", background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--ink)" }}
              >
                {LAYOUT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          )}

          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em", margin: "8px 0 0" }}>
            Destination
          </p>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, cursor: "pointer", color: "var(--ink)" }}>
            <input type="checkbox" checked={doDownload} onChange={(e) => setDoDownload(e.target.checked)} />
            Download to my computer
          </label>
          <label
            style={{
              display: "flex", alignItems: "center", gap: 8, fontSize: 12.5,
              cursor: isYouTubeConnected ? "pointer" : "not-allowed",
              color: isYouTubeConnected ? "var(--ink)" : "var(--ink-3)",
            }}
            title={!isYouTubeConnected ? "Connect YouTube in Settings first" : undefined}
          >
            <input
              type="checkbox"
              checked={doYouTube}
              disabled={!isYouTubeConnected}
              onChange={(e) => setDoYouTube(e.target.checked)}
            />
            Post to YouTube
            {!isPro && <span style={{ fontSize: 10, color: "var(--ink-3)", marginLeft: 4 }}>(Pro)</span>}
            {!isYouTubeConnected && isPro && <span style={{ fontSize: 10, color: "var(--ink-3)", marginLeft: 4 }}>(connect first)</span>}
          </label>
          {format === "vertical" && doYouTube && (
            <p style={{ fontSize: 11, color: "var(--orange, #d97706)", margin: 0, lineHeight: 1.4 }}>
              YouTube currently posts the horizontal version. Vertical YouTube uploads are coming soon. Use Download to get the 9:16 file.
            </p>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {error && (
            <p className="mono" style={{ fontSize: 11, color: "var(--danger)", margin: 0 }}>{error}</p>
          )}
          {progressNote && saving && (
            <p className="mono" style={{ fontSize: 11, color: "var(--ink-3)", margin: 0 }}>{progressNote}</p>
          )}
          {savedFlash && !saving && !error && (
            <p
              className="mono"
              style={{
                fontSize: 11.5,
                color: "var(--green, #A3E635)",
                margin: 0,
                padding: "6px 8px",
                background: "color-mix(in oklab, var(--green, #A3E635) 14%, var(--surface-2))",
                border: "1px solid color-mix(in oklab, var(--green, #A3E635) 32%, var(--line))",
                borderRadius: 6,
              }}
            >
              {savedFlash}
            </p>
          )}
          {readyDownload && !saving && (
            <a
              href={readyDownload.url}
              // download attribute hints to the browser to save instead of
              // navigating. Combined with the endpoint's
              // Content-Disposition: attachment header, this triggers a
              // direct download with no new tab and no popup blocker fight.
              download
              className="btn btn-blue"
              style={{
                width: "100%", justifyContent: "center", textAlign: "center",
                fontSize: 12.5, padding: "9px 0", textDecoration: "none",
              }}
            >
              {readyDownload.label}
            </a>
          )}
          {youtubeUrl && (
            <a href={youtubeUrl} target="_blank" rel="noopener noreferrer" className="mono" style={{ fontSize: 11, color: "var(--blue)" }}>
              Posted to YouTube — open
            </a>
          )}
          <button
            type="button"
            onClick={saveAndShip}
            disabled={saving || reverting || trimDuration < 2}
            className="btn btn-blue"
            style={{ width: "100%", justifyContent: "center", fontSize: 13, padding: "10px 0", opacity: saving || reverting || trimDuration < 2 ? 0.6 : 1 }}
          >
            {saving ? "Working…" : "Save & ship it"}
          </button>
          {hasOriginal && (
            <button
              type="button"
              onClick={revertToOriginal}
              disabled={saving || reverting}
              className="btn btn-ghost"
              style={{ width: "100%", justifyContent: "center", fontSize: 11.5, padding: "7px 0", opacity: saving || reverting ? 0.5 : 1 }}
              title="Throw away your edits and go back to the auto-generated cut"
            >
              {reverting ? "Reverting…" : "Revert to original"}
            </button>
          )}
          <p style={{ fontSize: 11, color: "var(--ink-3)", margin: 0, textAlign: "center" }}>
            Re-edits don&apos;t cost a clip.
          </p>
        </div>
      </div>
      <UpgradeModal
        isOpen={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        reason={upgradeReason}
      />
    </div>
  );
}
