"use client";

import { useState, useEffect } from "react";

export type StreamLayout = "no_cam" | "cam_br" | "cam_bl" | "cam_tr" | "cam_tl";

const LAYOUTS: Array<{
  id: StreamLayout;
  label: string;
  desc: string;
  // Which portion of the stacked 9:16 output is game vs cam
  gameRatio: number; // 0-1, how much of the frame is gameplay
  camPosition: "none" | "bottom" | "top";
  camAlign: "left" | "right" | "full" | "none";
}> = [
  {
    id: "no_cam",
    label: "No Facecam",
    desc: "Full gameplay, center cropped to 9:16",
    gameRatio: 1,
    camPosition: "none",
    camAlign: "none",
  },
  {
    id: "cam_br",
    label: "Bottom Right Cam",
    desc: "Game on top, facecam reaction below",
    gameRatio: 0.62,
    camPosition: "bottom",
    camAlign: "right",
  },
  {
    id: "cam_bl",
    label: "Bottom Left Cam",
    desc: "Game on top, facecam reaction below",
    gameRatio: 0.62,
    camPosition: "bottom",
    camAlign: "left",
  },
  {
    id: "cam_tr",
    label: "Top Right Cam",
    desc: "Facecam reaction on top, game below",
    gameRatio: 0.62,
    camPosition: "top",
    camAlign: "right",
  },
  {
    id: "cam_tl",
    label: "Top Left Cam",
    desc: "Facecam reaction on top, game below",
    gameRatio: 0.62,
    camPosition: "top",
    camAlign: "left",
  },
];

const STORAGE_KEY = "levlcast_clip_layout";

// ─── Layout Preview Card ───────────────────────────────────────────────────────

function LayoutPreview({ layout, selected }: { layout: typeof LAYOUTS[0]; selected: boolean }) {
  const W = 72;
  const H = 128; // 9:16
  const gameH = Math.round(H * layout.gameRatio);
  const camH = H - gameH;

  const gameY = layout.camPosition === "top" ? camH : 0;
  const camY = layout.camPosition === "top" ? 0 : gameH;

  // Caption lines — 3 white bars in the game area
  const captionY1 = gameY + Math.round(gameH * 0.44);
  const captionY2 = gameY + Math.round(gameH * 0.56);
  const captionY3 = gameY + Math.round(gameH * 0.68);

  return (
    <div style={{
      border: selected ? "2px solid #22D3EE" : "2px solid rgba(255,255,255,0.1)",
      borderRadius: 10,
      padding: 12,
      cursor: "pointer",
      background: selected ? "rgba(34,211,238,0.06)" : "rgba(255,255,255,0.02)",
      transition: "border-color 150ms, background 150ms",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 10,
    }}>
      {/* 9:16 frame mockup */}
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ borderRadius: 6, overflow: "hidden", display: "block" }}>
        {/* Background */}
        <rect width={W} height={H} fill="#0C111C" />

        {/* Game area */}
        <rect x={0} y={gameY} width={W} height={gameH} fill="#0F2040" />
        {/* Subtle game grid lines */}
        <line x1={0} y1={gameY} x2={W} y2={gameY} stroke="rgba(34,211,238,0.15)" strokeWidth={0.5} />
        {gameH > 0 && (
          <text x={W / 2} y={gameY + gameH / 2} textAnchor="middle" dominantBaseline="middle"
            fill="rgba(34,211,238,0.3)" fontSize={7} fontFamily="monospace" letterSpacing={0.5}>
            GAME
          </text>
        )}

        {/* Caption bars — shown in game area */}
        {layout.gameRatio > 0 && (
          <>
            <rect x={10} y={captionY1} width={52} height={5} rx={2.5} fill="white" opacity={0.7} />
            <rect x={14} y={captionY2} width={44} height={5} rx={2.5} fill="white" opacity={0.55} />
            <rect x={18} y={captionY3} width={36} height={4} rx={2} fill="white" opacity={0.3} />
          </>
        )}

        {/* Cam area */}
        {layout.camPosition !== "none" && camH > 0 && (
          <>
            {/* Full cam background */}
            <rect x={0} y={camY} width={W} height={camH} fill="#150F20" />
            <line x1={0} y1={camY} x2={W} y2={camY} stroke="rgba(255,255,255,0.08)" strokeWidth={0.5} />

            {/* Cam highlight — face silhouette circle */}
            {layout.camAlign === "right" && (
              <>
                <rect x={W * 0.45} y={camY} width={W * 0.55} height={camH} fill="#1D1030" />
                <circle cx={W * 0.73} cy={camY + camH * 0.42} r={camH * 0.28} fill="rgba(167,139,250,0.2)" />
                <ellipse cx={W * 0.73} cy={camY + camH * 0.85} rx={camH * 0.35} ry={camH * 0.18} fill="rgba(167,139,250,0.1)" />
                <text x={W * 0.22} y={camY + camH / 2} textAnchor="middle" dominantBaseline="middle"
                  fill="rgba(167,139,250,0.3)" fontSize={6} fontFamily="monospace">CAM</text>
              </>
            )}
            {layout.camAlign === "left" && (
              <>
                <rect x={0} y={camY} width={W * 0.55} height={camH} fill="#1D1030" />
                <circle cx={W * 0.27} cy={camY + camH * 0.42} r={camH * 0.28} fill="rgba(167,139,250,0.2)" />
                <ellipse cx={W * 0.27} cy={camY + camH * 0.85} rx={camH * 0.35} ry={camH * 0.18} fill="rgba(167,139,250,0.1)" />
                <text x={W * 0.78} y={camY + camH / 2} textAnchor="middle" dominantBaseline="middle"
                  fill="rgba(167,139,250,0.3)" fontSize={6} fontFamily="monospace">CAM</text>
              </>
            )}
            {layout.camAlign === "full" && (
              <>
                <circle cx={W / 2} cy={camY + camH * 0.42} r={camH * 0.3} fill="rgba(167,139,250,0.2)" />
                <ellipse cx={W / 2} cy={camY + camH * 0.85} rx={camH * 0.42} ry={camH * 0.18} fill="rgba(167,139,250,0.1)" />
                <text x={W / 2} y={camY + camH * 0.5} textAnchor="middle" dominantBaseline="middle"
                  fill="rgba(167,139,250,0.3)" fontSize={6} fontFamily="monospace">CAM</text>
              </>
            )}
          </>
        )}

        {/* Frame border */}
        <rect x={0} y={0} width={W} height={H} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
      </svg>

      {/* Label */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: selected ? "#22D3EE" : "#ECF1FA", lineHeight: 1.3 }}>
          {layout.label}
        </div>
        <div style={{ fontSize: 11, color: "#6F7C95", marginTop: 3, lineHeight: 1.3 }}>
          {layout.desc}
        </div>
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function ClipExportModal({
  clipId,
  clipTitle,
  onClose,
}: {
  clipId: string;
  clipTitle: string;
  onClose: () => void;
}) {
  const [layout, setLayout] = useState<StreamLayout>("cam_br");
  const [downloading, setDownloading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Load saved preference
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as StreamLayout | null;
    if (saved && LAYOUTS.find((l) => l.id === saved)) setLayout(saved);
  }, []);

  function handleSelect(id: StreamLayout) {
    setLayout(id);
    localStorage.setItem(STORAGE_KEY, id);
  }

  async function handleExport() {
    setDownloading(true);
    setExportError(null);
    try {
      const res = await fetch(`/api/clips/${clipId}/export?layout=${layout}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).error || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${clipTitle.replace(/[^a-z0-9\-_ ]/gi, "").trim() || "clip"}-vertical.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed. Try again.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
    }} onClick={onClose}>
      <div style={{
        background: "#0C111C",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 16,
        padding: "28px 28px 24px",
        width: "100%",
        maxWidth: 580,
        maxHeight: "90vh",
        overflowY: "auto",
      }} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontFamily: "monospace", letterSpacing: "0.2em", textTransform: "uppercase", color: "#6F7C95" }}>
                Export Clip
              </div>
              <span style={{ fontSize: 10, fontFamily: "monospace", letterSpacing: "0.12em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 999, border: "1px solid rgba(251,191,36,0.4)", background: "rgba(251,191,36,0.08)", color: "rgb(251,191,36)", fontWeight: 700 }}>
                Beta
              </span>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: "#ECF1FA", margin: 0, lineHeight: 1.2 }}>
              {clipTitle}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#6F7C95", fontSize: 20, cursor: "pointer", padding: "0 0 0 16px", lineHeight: 1 }}>
            ✕
          </button>
        </div>

        {/* Format badge */}
        <div style={{ display: "flex", gap: 6, marginBottom: 24, marginTop: 14 }}>
          {["TikTok", "YouTube Shorts", "Instagram Reels"].map((p) => (
            <span key={p} style={{ fontSize: 11, padding: "3px 9px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", color: "#A6B3C9" }}>
              {p}
            </span>
          ))}
        </div>

        {/* Layout picker */}
        <div style={{ fontSize: 12, fontWeight: 600, color: "#ECF1FA", marginBottom: 14, letterSpacing: "0.02em" }}>
          Choose your stream layout
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 24 }}>
          {LAYOUTS.map((l) => (
            <div key={l.id} onClick={() => handleSelect(l.id)}>
              <LayoutPreview layout={l} selected={layout === l.id} />
            </div>
          ))}
        </div>

        {/* Beta notice */}
        <div style={{ padding: "12px 16px", borderRadius: 8, background: "rgba(251,191,36,0.04)", border: "1px solid rgba(251,191,36,0.2)", marginBottom: exportError ? 12 : 20 }}>
          <div style={{ fontSize: 12, color: "rgb(251,191,36)", fontWeight: 600, marginBottom: 4 }}>
            Beta — facecam detection is estimated
          </div>
          <div style={{ fontSize: 12, color: "#6F7C95", lineHeight: 1.5 }}>
            The crop assumes a typical streamer layout (webcam in the corner). If your webcam is in a different spot, the cut may be off. Captions overlay coming in a future update.
          </div>
        </div>

        {/* Export error */}
        {exportError && (
          <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)", marginBottom: 20, fontSize: 12, color: "#F87171" }}>
            {exportError}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "#A6B3C9", fontSize: 13, cursor: "pointer" }}>
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={downloading}
            style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: "#22D3EE", color: "#001318", fontSize: 13, fontWeight: 700, cursor: downloading ? "not-allowed" : "pointer", opacity: downloading ? 0.7 : 1 }}>
            {downloading ? "Processing…" : "Export Vertical"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Export Button (used on clip cards) ───────────────────────────────────────

export function ExportClipButton({ clipId, clipTitle }: { clipId: string; clipTitle: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(34,211,238,0.35)", background: "rgba(34,211,238,0.08)", color: "#22D3EE", cursor: "pointer", width: "100%", justifyContent: "center" }}
      >
        Export for TikTok / Shorts
        <span style={{ fontSize: 9, fontFamily: "monospace", letterSpacing: "0.1em", padding: "1px 5px", borderRadius: 999, border: "1px solid rgba(251,191,36,0.5)", background: "rgba(251,191,36,0.08)", color: "rgb(251,191,36)", fontWeight: 700, textTransform: "uppercase" }}>
          Beta
        </span>
      </button>
      {open && (
        <ClipExportModal
          clipId={clipId}
          clipTitle={clipTitle}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
