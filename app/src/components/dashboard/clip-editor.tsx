"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pause, Play, Plus, X } from "lucide-react";
import type { CaptionCard, CaptionStyle } from "@/lib/captions";
import { UpgradeModal } from "@/components/dashboard/upgrade-modal";

/*
 * The clip editor. The preview is the export: in 9:16 it draws the same
 * layout exportClipVertical renders (lib/ffmpeg.ts), facecam panel and
 * gameplay each cropped to their own shape, and captions sit where and how
 * they'll be burned, in Roboto Bold at the renderer's sizes (lib/captions.ts).
 *
 * It replaced an editor of range sliders, a facecam dropdown of four fixed
 * corners, and caption styles you could only see after rendering. The
 * corners were wrong for two of the four presets, and the vertical export
 * ignored caption edits; both are fixed in the renderer too.
 */

type EditorCard = CaptionCard & { id: string };
type CamBox = { x: number; y: number; w: number; h: number };
type Format = "vertical" | "horizontal";

let cardSeq = 0;
const cardId = () => `card_${++cardSeq}`;

/** Output sizes, as in exportClipVertical: gameplay 62% of the height, facecam the rest. */
const OUT_W = 1080;
const OUT_H = 1920;
const GAME_SHARE = 0.62;
/** Horizontal clips are captioned at 720p (cutClip). */
const HORIZONTAL_CAPTION_HEIGHT = 720;
/** Vertical exports caption every style at this size (exportClipVertical). */
const VERTICAL_CAPTION_SIZE = 72;
const MAX_CAPTION_CHARS = 60;
const MIN_CLIP_SECONDS = 2;
const FRAME_POSITIONS = [0.1, 0.35, 0.65, 0.9] as const;

/** Each caption style's drawtext settings (lib/captions.ts), for the preview. */
const CAPTION_LOOK: Record<
  CaptionStyle,
  { label: string; size: number; color: string; border: number; borderColor: string; shadow: [number, number, string]; upper: boolean; box?: string }
> = {
  bold: { label: "Bold", size: 78, color: "#fff", border: 8, borderColor: "#000", shadow: [3, 4, "#000"], upper: true },
  boxed: { label: "Boxed", size: 68, color: "#fff", border: 0, borderColor: "transparent", shadow: [0, 0, "transparent"], upper: true, box: "rgba(0,0,0,0.55)" },
  minimal: { label: "Minimal", size: 54, color: "rgba(255,255,255,0.92)", border: 3, borderColor: "rgba(0,0,0,0.7)", shadow: [2, 3, "rgba(0,0,0,0.5)"], upper: false },
  classic: { label: "Classic", size: 74, color: "#ffff00", border: 7, borderColor: "#000", shadow: [3, 4, "#000"], upper: true },
  neon: { label: "Neon", size: 70, color: "#00eeff", border: 5, borderColor: "#003344", shadow: [3, 4, "#001122"], upper: true },
  fire: { label: "Fire", size: 76, color: "#ff6b00", border: 7, borderColor: "#1a0000", shadow: [4, 5, "#330000"], upper: true },
  impact: { label: "Impact", size: 96, color: "#fff", border: 12, borderColor: "#000", shadow: [5, 6, "#000"], upper: true },
};
const STYLES = Object.keys(CAPTION_LOOK) as CaptionStyle[];

/** Quick facecam spots: a quarter of the frame each way, like the old presets. */
const CAM_PRESETS: { label: string; box: CamBox }[] = [
  { label: "Top left", box: { x: 0, y: 0, w: 0.25, h: 0.25 } },
  { label: "Top right", box: { x: 0.75, y: 0, w: 0.25, h: 0.25 } },
  { label: "Bottom left", box: { x: 0, y: 0.75, w: 0.25, h: 0.25 } },
  { label: "Bottom right", box: { x: 0.75, y: 0.75, w: 0.25, h: 0.25 } },
];

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function fmt(t: number): string {
  if (!Number.isFinite(t) || t < 0) t = 0;
  // Whole tenths first, so 15.2 - 3 reads 0:12.2 and not 0:12.1.
  const tenths = Math.round(t * 10);
  const m = Math.floor(tenths / 600);
  const s = Math.floor((tenths % 600) / 10);
  return `${m}:${String(s).padStart(2, "0")}.${tenths % 10}`;
}

/** Same rules as cleanCamBox in lib/ffmpeg.ts. */
function cleanBox(b: CamBox): CamBox {
  const w = clamp(b.w, 0.05, 1);
  const h = clamp(b.h, 0.05, 1);
  return { x: clamp(b.x, 0, 1 - w), y: clamp(b.y, 0, 1 - h), w, h };
}

/** A caption drawn the way the renderer draws it. `px` is screen pixels per output pixel. */
function captionCss(style: CaptionStyle, px: number, vertical: boolean): React.CSSProperties {
  const look = CAPTION_LOOK[style];
  const [sx, sy, sc] = look.shadow;
  return {
    fontSize: (vertical ? VERTICAL_CAPTION_SIZE : look.size) * px,
    color: look.color,
    textTransform: look.upper ? "uppercase" : "none",
    // drawtext's border sits outside the glyph; a centred stroke painted
    // under the fill shows half its width, so it's doubled.
    WebkitTextStroke: look.border > 0 ? `${look.border * 2 * px}px ${look.borderColor}` : undefined,
    textShadow: sx || sy ? `${sx * px}px ${sy * px}px 0 ${sc}` : undefined,
    background: look.box,
    padding: look.box ? `${4 * px}px ${14 * px}px` : undefined,
  };
}

/**
 * Draw one frame of the 9:16 layout onto the canvas: exportClipVertical's
 * filter graph, in canvas terms. Each source area fills its panel the way
 * CSS object-fit: cover does, which is what scale-then-crop does in ffmpeg.
 */
function drawVertical(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, cam: CamBox | null, camAt: "top" | "bottom") {
  const { width: cw, height: ch } = ctx.canvas;
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, cw, ch);
  if (!vw || !vh) return;
  const cover = (sx: number, sy: number, sw: number, sh: number, dy: number, dh: number) => {
    const want = cw / dh;
    let w = sw;
    let h = sh;
    if (sw / sh > want) w = sh * want;
    else h = sw / want;
    ctx.drawImage(video, sx + (sw - w) / 2, sy + (sh - h) / 2, w, h, 0, dy, cw, dh);
  };
  if (!cam) {
    cover(0, 0, vw, vh, 0, ch);
    return;
  }
  const gameH = Math.round(ch * GAME_SHARE);
  const camH = ch - gameH;
  cover(0, 0, vw, vh, camAt === "top" ? camH : 0, gameH);
  cover(cam.x * vw, cam.y * vh, cam.w * vw, cam.h * vh, camAt === "top" ? 0 : gameH, camH);
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
  title,
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
  /** True when an original_* snapshot exists (the clip has been edited at least once). */
  hasOriginal: boolean;
  title: string;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const inputRefs = useRef(new Map<string, HTMLInputElement>());

  // The clean source being edited. Replaced by the new cut after a save,
  // so the editor keeps working on what was saved.
  const [src, setSrc] = useState(videoUrl);
  const [duration, setDuration] = useState(fullDuration);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(fullDuration);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const initialCards = useMemo<EditorCard[]>(
    () => defaultCards.map((c) => ({ ...c, id: cardId() })),
    // Once, on mount: later edits live in state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const [cards, setCards] = useState<EditorCard[]>(initialCards);
  const [style, setStyle] = useState<CaptionStyle>(captionStyle);
  const [format, setFormat] = useState<Format>("vertical");
  const [cam, setCam] = useState<CamBox | null>({ x: 0.75, y: 0.75, w: 0.25, h: 0.25 });
  const [camAt, setCamAt] = useState<"top" | "bottom">("top");
  const [frames, setFrames] = useState<string[]>(candidateFrames);
  const [framesLoading, setFramesLoading] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(capturedThumbnailUrl);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The last file handed over, kept until something changes so the button
  // can hand it over again without another render.
  const [download, setDownload] = useState<{ url: string; filename?: string } | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState<string | null>(null);
  const [reverting, setReverting] = useState(false);
  const [upgrade, setUpgrade] = useState<string | null>(null);
  const [frameSize, setFrameSize] = useState({ w: 0, h: 0 });

  const vertical = format === "vertical";
  // Trim, captions, style and cover are saved on the clip. Format and
  // facecam only shape the download, so they don't need a save, but an
  // earlier download no longer matches them.
  const edited = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setDirty(true);
    setDownload(null);
    setYoutubeUrl(null);
  };
  const reshaped = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setDownload(null);
  };

  // ── Playback, kept inside the trim ───────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onMeta = () => {
      if (Number.isFinite(v.duration) && v.duration > 0) {
        setDuration(v.duration);
        setTrimEnd((e) => (e >= fullDuration - 0.05 || e > v.duration ? v.duration : e));
      }
    };
    const onTime = () => setTime(v.currentTime);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("seeked", onTime);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    if (v.readyState >= 1) onMeta();
    return () => {
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("seeked", onTime);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
  }, [src, fullDuration]);

  // Smooth time and the loop while playing; timeupdate alone is ~4 a second.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v) {
        if (v.currentTime >= trimEnd) v.currentTime = trimStart;
        setTime(v.currentTime);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, trimStart, trimEnd]);

  // The 9:16 preview, redrawn every frame it's on screen.
  useEffect(() => {
    if (!vertical) return;
    let raf = 0;
    const draw = () => {
      const v = videoRef.current;
      const ctx = canvasRef.current?.getContext("2d");
      if (v && ctx && v.readyState >= 2) drawVertical(ctx, v, cam, camAt);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [vertical, cam, camAt, src]);

  // The preview's size on screen, for sizing captions like the renderer.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setFrameSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [vertical]);

  // A rendered 9:16 lives in memory until it's replaced or the page closes.
  useEffect(() => {
    const url = download?.url;
    return () => {
      if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
    };
  }, [download]);

  const seek = useCallback((t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = t;
    setTime(t);
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      if (v.currentTime < trimStart || v.currentTime >= trimEnd - 0.05) v.currentTime = trimStart;
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [trimStart, trimEnd]);

  // Space plays and pauses, except while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.closest("input, textarea, select, button, [role=slider]") || t.isContentEditable)) return;
      e.preventDefault();
      togglePlay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay]);

  // ── Captions ─────────────────────────────────────────────────────────
  const active = cards.find((c) => time >= c.start && time < c.end && c.end > trimStart && c.start < trimEnd) ?? null;

  function setCardText(id: string, text: string) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, text: text.slice(0, MAX_CAPTION_CHARS) } : c)));
    setDirty(true);
  }
  function dropCard(id: string) {
    setCards((prev) => prev.filter((c) => c.id !== id));
    setDirty(true);
  }
  function addCard() {
    const start = clamp(time, trimStart, Math.max(trimStart, trimEnd - 0.4));
    const end = Math.min(trimEnd, start + 1.4);
    if (end - start < 0.3) return;
    const id = cardId();
    setCards((prev) => [...prev, { id, start, end, text: "" }].sort((a, b) => a.start - b.start));
    setDirty(true);
    requestAnimationFrame(() => inputRefs.current.get(id)?.focus());
  }
  function pickCard(c: EditorCard) {
    seek(c.start + 0.01);
    inputRefs.current.get(c.id)?.focus();
  }

  // ── Cover ────────────────────────────────────────────────────────────
  async function loadFrames() {
    setFramesLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clips/${clipId}/frames`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Couldn't pull frames from the clip.");
        return;
      }
      setFrames(json.frames as string[]);
    } catch {
      setError("Couldn't reach LevlCast. Try again.");
    } finally {
      setFramesLoading(false);
    }
  }

  // ── Save, then download or post ──────────────────────────────────────
  async function save(): Promise<boolean> {
    videoRef.current?.pause();
    setBusy("Saving your edits");
    const res = await fetch(`/api/clips/${clipId}/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trimStart,
        trimEnd,
        editedCaptions: cards.map(({ start, end, text }) => ({ start, end, text })),
        captionStyle: style,
        thumbnailUrl,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "Saving didn't work. Try again.");
      return false;
    }
    // The server now holds the trimmed cut as the clip; carry on editing it.
    const offset = trimStart;
    const length = trimEnd - trimStart;
    setCards((prev) =>
      prev
        .map((c) => ({ ...c, start: Math.max(0, c.start - offset), end: Math.min(length, c.end - offset) }))
        .filter((c) => c.text.trim() && c.end > c.start + 0.05)
    );
    if (typeof json.sourceUrl === "string") setSrc(json.sourceUrl);
    // The new cut loads at its first frame.
    setTime(0);
    setTrimStart(0);
    setTrimEnd(length);
    setDuration(length);
    // The server drops the frames it pulled from the old cut.
    setFrames([]);
    setDirty(false);
    return true;
  }

  /** Hand the browser a file to save. */
  function hand(url: string, filename?: string) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename ?? "";
    a.click();
  }

  async function saveAndDownload() {
    if (vertical && !isPro) {
      setUpgrade("Vertical clips are a Pro feature. Pro exports them ready for Shorts, TikTok and Reels.");
      return;
    }
    // This exact version was just made: hand it over again, no new render.
    if (download && !dirty) {
      hand(download.url, download.filename);
      return;
    }
    setError(null);
    try {
      // Nothing to save means the clip on file is already this cut.
      if (dirty && !(await save())) return;
      if (!vertical) {
        const url = `/api/clips/${clipId}/download`;
        setDownload({ url });
        hand(url);
        return;
      }
      setBusy("Rendering the vertical version. This takes about a minute.");
      const params = new URLSearchParams({ camAt, cam: cam ? [cam.x, cam.y, cam.w, cam.h].map((n) => n.toFixed(4)).join(",") : "none" });
      const res = await fetch(`/api/clips/${clipId}/export?${params}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error || "The vertical render didn't finish. Try again.");
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      const filename = `${(title || "clip").replace(/[^a-z0-9\-_ ]/gi, "").trim() || "clip"}-vertical.mp4`;
      setDownload({ url, filename });
      hand(url, filename);
    } catch {
      setError("Couldn't reach LevlCast. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function saveAndPost() {
    if (!isPro) {
      setUpgrade("Posting to YouTube is a Pro feature. Pro posts clips straight from LevlCast.");
      return;
    }
    if (!isYouTubeConnected) {
      setError("Connect YouTube in Settings first.");
      return;
    }
    setError(null);
    setYoutubeUrl(null);
    try {
      if (dirty && !(await save())) return;
      setBusy("Posting to YouTube");
      const res = await fetch("/api/youtube/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clipId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(`Saved, but YouTube didn't take it: ${json.error || "unknown error"}`);
        return;
      }
      if (json.url) setYoutubeUrl(json.url);
    } catch {
      setError("Couldn't reach LevlCast. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function revert() {
    if (!window.confirm("Go back to the original cut? Your trim, caption edits and cover will be thrown away.")) return;
    setReverting(true);
    setError(null);
    try {
      const res = await fetch(`/api/clips/${clipId}/revert`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Revert didn't work.");
        return;
      }
      // The page remounts the editor on the restored clip.
      router.refresh();
    } catch {
      setError("Couldn't reach LevlCast. Try again.");
    } finally {
      setReverting(false);
    }
  }

  // ── Layout numbers ───────────────────────────────────────────────────
  const length = Math.max(0, trimEnd - trimStart);
  const px = vertical ? frameSize.w / OUT_W : frameSize.h / HORIZONTAL_CAPTION_HEIGHT;
  const gameTop = cam && camAt === "top" ? 1 - GAME_SHARE : 0;
  const captionY = vertical ? (cam ? gameTop + GAME_SHARE * 0.72 : 0.72) : 0.7;

  return (
    <div className="ce">
      {/* ── The preview, the transport and the timeline ── */}
      <section className="ce-stage" aria-label="Preview">
        <div className="ce-frame-wrap" data-format={format}>
          <div className="ce-frame" ref={frameRef} data-format={format} onClick={togglePlay}>
            <video
              ref={videoRef}
              key={src}
              src={src}
              preload="auto"
              playsInline
              className={vertical ? "ce-src ce-src-hidden" : "ce-src"}
            />
            {vertical && <canvas ref={canvasRef} className="ce-canvas" width={OUT_W / 2} height={OUT_H / 2} />}
            {active && active.text.trim() && frameSize.w > 0 && (
              <p className="ce-cap" style={{ top: `${captionY * 100}%`, ...captionCss(style, px, vertical) }}>
                {active.text}
              </p>
            )}
          </div>
        </div>

        <div className="ce-transport">
          <button type="button" className="ce-play" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>
            {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
          </button>
          <p className="ce-clock">
            {fmt(Math.max(0, time - trimStart))} <span>/ {fmt(length)}</span>
          </p>
          {dirty && <p className="ce-dirty">Unsaved changes</p>}
        </div>

        <Timeline
          duration={duration}
          start={trimStart}
          end={trimEnd}
          time={time}
          cards={cards}
          activeId={active?.id ?? null}
          onSeek={seek}
          onTrim={(s, e) => {
            setTrimStart(s);
            setTrimEnd(e);
            setDirty(true);
            setDownload(null);
          }}
          onPickCard={pickCard}
        />
      </section>

      {/* ── Everything you can change ── */}
      <div className="ce-side">
        <section className="ce-sec">
          <p className="hm-k">Format</p>
          <div className="ce-seg" role="radiogroup" aria-label="Format">
            <button type="button" role="radio" aria-checked={vertical} onClick={() => reshaped(setFormat)("vertical")}>
              <b>9:16</b>
              <span>Shorts, TikTok, Reels{!isPro && " · Pro"}</span>
            </button>
            <button type="button" role="radio" aria-checked={!vertical} onClick={() => reshaped(setFormat)("horizontal")}>
              <b>16:9</b>
              <span>YouTube, X, Discord</span>
            </button>
          </div>
        </section>

        {vertical && (
          <section className="ce-sec">
            <p className="hm-k">
              Facecam
              <button type="button" className="ce-link" onClick={() => reshaped(setCam)(cam ? null : { x: 0.75, y: 0.75, w: 0.25, h: 0.25 })}>
                {cam ? "No facecam" : "Add facecam"}
              </button>
            </p>
            {cam ? (
              <>
                <CamPicker video={videoRef} time={time} src={src} box={cam} onBox={reshaped(setCam)} />
                <p className="ce-hint">Drag the box onto your camera. Pull its corner to resize.</p>
                <div className="ce-row">
                  <div className="ce-seg ce-seg-sm" role="radiogroup" aria-label="Where the facecam goes">
                    <button type="button" role="radio" aria-checked={camAt === "top"} onClick={() => reshaped(setCamAt)("top")}>
                      Cam on top
                    </button>
                    <button type="button" role="radio" aria-checked={camAt === "bottom"} onClick={() => reshaped(setCamAt)("bottom")}>
                      Cam at bottom
                    </button>
                  </div>
                </div>
                <div className="ce-presets">
                  {CAM_PRESETS.map((p) => (
                    <button key={p.label} type="button" onClick={() => reshaped(setCam)(p.box)}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="ce-hint">Gameplay fills the whole frame.</p>
            )}
          </section>
        )}

        <section className="ce-sec">
          <p className="hm-k">
            Captions
            <button type="button" className="ce-link" onClick={addCard}>
              <Plus size={12} aria-hidden="true" /> Line at playhead
            </button>
          </p>
          <div className="ce-styles" role="radiogroup" aria-label="Caption style">
            {STYLES.map((s) => (
              <button key={s} type="button" role="radio" aria-checked={style === s} onClick={() => edited(setStyle)(s)}>
                <span className="ce-style-aa" style={captionCss(s, 0.26, false)}>
                  Aa
                </span>
                {CAPTION_LOOK[s].label}
              </button>
            ))}
          </div>
          {cards.length === 0 ? (
            <p className="ce-hint">No captions. Add a line at the playhead, or the clip goes out without them.</p>
          ) : (
            <ol className="ce-lines">
              {cards.map((c) => {
                const inside = c.end > trimStart && c.start < trimEnd;
                return (
                  <li key={c.id} data-active={active?.id === c.id ? "yes" : undefined} data-outside={inside ? undefined : "yes"}>
                    <button type="button" className="ce-line-t" onClick={() => pickCard(c)} title="Jump here">
                      {fmt(Math.max(0, c.start - trimStart))}
                    </button>
                    <input
                      ref={(el) => {
                        if (el) inputRefs.current.set(c.id, el);
                        else inputRefs.current.delete(c.id);
                      }}
                      type="text"
                      value={c.text}
                      maxLength={MAX_CAPTION_CHARS}
                      placeholder="Type the line"
                      onFocus={() => {
                        if (time < c.start || time >= c.end) seek(c.start + 0.01);
                      }}
                      onChange={(e) => setCardText(c.id, e.target.value)}
                    />
                    <button type="button" className="ce-line-x" onClick={() => dropCard(c.id)} aria-label="Remove this line">
                      <X size={13} />
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section className="ce-sec">
          <p className="hm-k">
            Cover
            {frames.length === 0 && !framesLoading && (
              <button type="button" className="ce-link" onClick={loadFrames}>
                Pick a frame
              </button>
            )}
          </p>
          {framesLoading ? (
            <p className="ce-hint">
              <Loader2 size={12} className="animate-spin" aria-hidden="true" /> Pulling four frames from the clip
            </p>
          ) : frames.length === 0 ? (
            <div className="ce-cover-now">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {thumbnailUrl && <img src={thumbnailUrl} alt="" />}
              <p className="ce-hint">The picture people see before they press play.</p>
            </div>
          ) : (
            <div className="ce-covers">
              {frames.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  aria-pressed={thumbnailUrl === url}
                  onClick={() => edited(setThumbnailUrl)(url)}
                  title={`Frame at ${fmt(duration * (FRAME_POSITIONS[i] ?? 0))}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" />
                  {thumbnailUrl === url && <Check size={14} aria-hidden="true" />}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="ce-sec ce-ship">
          {error && <p className="ce-error">{error}</p>}
          {busy && (
            <p className="ce-busy">
              <Loader2 size={13} className="animate-spin" aria-hidden="true" /> {busy}
            </p>
          )}
          {!busy && download && (
            <p className="ce-done">
              <Check size={14} aria-hidden="true" /> Done. It&apos;s in your downloads.
            </p>
          )}
          {!busy && youtubeUrl && (
            <p className="ce-done">
              <Check size={14} aria-hidden="true" /> Posted.
              <a href={youtubeUrl} target="_blank" rel="noopener noreferrer">
                View it on YouTube
              </a>
            </p>
          )}
          <button
            type="button"
            className="btn btn-blue ce-go"
            onClick={saveAndDownload}
            disabled={!!busy || reverting || length < MIN_CLIP_SECONDS}
          >
            {vertical && !isPro
              ? "Go Pro to download 9:16"
              : `${dirty ? "Save and download" : "Download"} ${vertical ? "9:16" : "16:9"}`}
          </button>
          {isPro && !isYouTubeConnected ? (
            <Link href="/dashboard/settings#connections" className="btn btn-ghost ce-go">
              Connect YouTube to post there
            </Link>
          ) : (
            <button
              type="button"
              className="btn btn-ghost ce-go"
              onClick={saveAndPost}
              disabled={!!busy || reverting || length < MIN_CLIP_SECONDS}
            >
              Post to YouTube{!isPro && " · Pro"}
            </button>
          )}
          {vertical && <p className="ce-hint">YouTube gets the 16:9 version for now.</p>}
          <p className="ce-hint">
            Edits don&apos;t use up a clip.
            {hasOriginal && (
              <>
                {" "}
                <button type="button" className="ce-link" onClick={revert} disabled={!!busy || reverting}>
                  {reverting ? "Going back..." : "Go back to the original cut"}
                </button>
              </>
            )}
          </p>
        </section>
      </div>

      <UpgradeModal isOpen={upgrade !== null} onClose={() => setUpgrade(null)} reason={upgrade ?? ""} />
    </div>
  );
}

/**
 * The clip on a line: drag the ends to trim, drag or click anywhere else to
 * scrub. Captions sit on the line as marks you can click to jump to.
 */
function Timeline({
  duration,
  start,
  end,
  time,
  cards,
  activeId,
  onSeek,
  onTrim,
  onPickCard,
}: {
  duration: number;
  start: number;
  end: number;
  time: number;
  cards: EditorCard[];
  activeId: string | null;
  onSeek: (t: number) => void;
  onTrim: (start: number, end: number) => void;
  onPickCard: (c: EditorCard) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const d = Math.max(duration, 0.1);
  const pct = (t: number) => `${clamp(t / d, 0, 1) * 100}%`;

  const drag = (e: React.PointerEvent, what: "start" | "end" | "seek") => {
    const track = trackRef.current;
    if (!track) return;
    e.preventDefault();
    const rect = track.getBoundingClientRect();
    const at = (x: number) => clamp((x - rect.left) / rect.width, 0, 1) * d;
    const apply = (x: number) => {
      const t = at(x);
      if (what === "start") onTrim(Math.min(t, end - MIN_CLIP_SECONDS), end);
      else if (what === "end") onTrim(start, Math.max(t, start + MIN_CLIP_SECONDS));
      else onSeek(clamp(t, start, end));
    };
    apply(e.clientX);
    const move = (ev: PointerEvent) => apply(ev.clientX);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const nudge = (e: React.KeyboardEvent, which: "start" | "end") => {
    const step = e.shiftKey ? 1 : 0.1;
    const delta = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
    if (!delta) return;
    e.preventDefault();
    if (which === "start") onTrim(clamp(start + delta, 0, end - MIN_CLIP_SECONDS), end);
    else onTrim(start, clamp(end + delta, start + MIN_CLIP_SECONDS, d));
  };

  return (
    <div className="ce-tl">
      <div className="ce-tl-track" ref={trackRef} onPointerDown={(e) => drag(e, "seek")}>
        <span className="ce-tl-out" style={{ left: 0, width: pct(start) }} />
        <span className="ce-tl-out" style={{ left: pct(end), right: 0 }} />
        <span className="ce-tl-keep" style={{ left: pct(start), width: `calc(${pct(end)} - ${pct(start)})` }} />
        {cards.map((c) => (
          <button
            key={c.id}
            type="button"
            className="ce-tl-cap"
            data-active={c.id === activeId ? "yes" : undefined}
            style={{ left: pct(c.start), width: `max(3px, calc(${pct(c.end)} - ${pct(c.start)}))` }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onPickCard(c)}
            aria-label={c.text ? `Caption: ${c.text}` : "Empty caption"}
            title={c.text}
          />
        ))}
        <span className="ce-tl-head" style={{ left: pct(time) }} />
        {(["start", "end"] as const).map((side) => (
          <span
            key={side}
            className="ce-tl-handle"
            data-side={side}
            style={{ left: pct(side === "start" ? start : end) }}
            role="slider"
            tabIndex={0}
            aria-label={side === "start" ? "Clip start" : "Clip end"}
            aria-valuemin={0}
            aria-valuemax={Math.round(d * 10) / 10}
            aria-valuenow={Math.round((side === "start" ? start : end) * 10) / 10}
            onPointerDown={(e) => {
              e.stopPropagation();
              drag(e, side);
            }}
            onKeyDown={(e) => nudge(e, side)}
          />
        ))}
      </div>
      <div className="ce-tl-times">
        <span>{fmt(start)}</span>
        <span>Drag the ends to trim</span>
        <span>{fmt(end)}</span>
      </div>
    </div>
  );
}

/**
 * The whole 16:9 frame with the facecam box on it. Drag the box to move it,
 * pull its corner to resize, or drag across the frame to draw a new one.
 */
function CamPicker({
  video,
  time,
  src,
  box,
  onBox,
}: {
  video: React.RefObject<HTMLVideoElement | null>;
  time: number;
  src: string;
  box: CamBox;
  onBox: (b: CamBox) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // The current frame: once it has loaded, after every seek, and as it plays.
  useEffect(() => {
    const v = video.current;
    const canvas = canvasRef.current;
    if (!v || !canvas) return;
    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (ctx && v.readyState >= 2) ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    };
    draw();
    v.addEventListener("loadeddata", draw);
    v.addEventListener("seeked", draw);
    return () => {
      v.removeEventListener("loadeddata", draw);
      v.removeEventListener("seeked", draw);
    };
  }, [video, src]);
  useEffect(() => {
    const v = video.current;
    const ctx = canvasRef.current?.getContext("2d");
    if (v && ctx && v.readyState >= 2) ctx.drawImage(v, 0, 0, ctx.canvas.width, ctx.canvas.height);
  }, [video, time]);

  const start = (e: React.PointerEvent, mode: "move" | "resize" | "draw") => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = wrap.getBoundingClientRect();
    const from = { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height, box };
    const move = (ev: PointerEvent) => {
      const x = clamp((ev.clientX - rect.left) / rect.width, 0, 1);
      const y = clamp((ev.clientY - rect.top) / rect.height, 0, 1);
      if (mode === "move") onBox(cleanBox({ ...from.box, x: from.box.x + x - from.x, y: from.box.y + y - from.y }));
      else if (mode === "resize") onBox(cleanBox({ ...from.box, w: x - from.box.x, h: y - from.box.y }));
      else
        onBox(
          cleanBox({ x: Math.min(from.x, x), y: Math.min(from.y, y), w: Math.abs(x - from.x), h: Math.abs(y - from.y) })
        );
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className="ce-cam" ref={wrapRef} onPointerDown={(e) => start(e, "draw")}>
      <canvas ref={canvasRef} width={480} height={270} />
      <div
        className="ce-cam-box"
        style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%` }}
        onPointerDown={(e) => start(e, "move")}
      >
        <span className="ce-cam-tag">Facecam</span>
        <span className="ce-cam-grip" onPointerDown={(e) => start(e, "resize")} aria-hidden="true" />
      </div>
    </div>
  );
}
