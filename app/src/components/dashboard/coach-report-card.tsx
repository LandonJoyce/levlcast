"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Lock } from "lucide-react";
import { CoachReport } from "@/lib/analyze";
import { computeReportDelta } from "@/lib/report-delta";
import { isPulseViable } from "@/lib/chat-pulse";
import { UpgradeModal } from "./upgrade-modal";
import { LastStreamRecap } from "./last-stream-recap";
import { ScoreTrajectory, type TrajectoryPoint } from "./score-trajectory";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(n: number) {
  return n >= 66 ? "#A3E635" : n >= 33 ? "#F59E0B" : "#F87171";
}

function parseItem(raw: string) {
  const recurring = /^RECURRING:\s*/i.test(raw);
  const cleaned = raw.replace(/^RECURRING:\s*/i, "");
  const m = cleaned.match(/^\*\*(.+?)\*\*\s*[—–-]\s*([\s\S]+)$/);
  if (!m) return { label: "", body: cleaned, ts: null, recurring };
  let body = m[2].trim();
  const tsM = body.match(/\s+at\s+(\d{1,2}:\d{2})\.?\s*$/i);
  const ts = tsM ? tsM[1] : null;
  if (tsM) body = body.slice(0, tsM.index!).trim().replace(/\.$/, "");
  return { label: m[1], body, ts, recurring };
}

function parseTimeSecs(t: string): number {
  const parts = t.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
}

function fmtDur(s: number) {
  if (s >= 60) return `${Math.floor(s / 60)}m${s % 60 > 0 ? ` ${s % 60}s` : ""}`;
  return `${s}s`;
}

function fmtTimestamp(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ─── Audio ────────────────────────────────────────────────────────────────────

function buildScript(r: CoachReport, prev?: number) {
  const p = [`Stream score: ${r.overall_score} out of 100.`];
  if (prev !== undefined) {
    const d = r.overall_score - prev;
    if (d > 0) p.push(`Up ${d} from last stream.`);
    else if (d < 0) p.push(`Down ${Math.abs(d)} from last stream.`);
  }
  p.push(`Number one priority. ${r.recommendation}`);
  (r.next_stream_goals ?? []).forEach((g, i) => p.push(`Mission ${i + 1}. ${g}`));
  return p.join(" ");
}

type PS = "idle" | "loading" | "playing" | "paused";

function useAudio(r: CoachReport, prev?: number) {
  const [ps, setPs] = useState<PS>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobRef = useRef<string | null>(null);
  const speechRef = useRef(false);

  useEffect(() => () => {
    audioRef.current?.pause();
    if (blobRef.current) URL.revokeObjectURL(blobRef.current);
    window.speechSynthesis?.cancel();
  }, []);

  const play = useCallback(async () => {
    if (ps === "paused" && speechRef.current) { window.speechSynthesis?.resume(); setPs("playing"); return; }
    if (ps === "paused" && audioRef.current) { audioRef.current.play(); setPs("playing"); return; }
    if (blobRef.current && audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play(); setPs("playing"); return; }
    setPs("loading");
    try {
      const res = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: buildScript(r, prev) }) });
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      blobRef.current = url; speechRef.current = false;
      const a = new Audio(url);
      a.onended = a.onerror = () => setPs("idle");
      audioRef.current = a; await a.play(); setPs("playing");
    } catch {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(buildScript(r, prev));
        utt.rate = 0.95;
        const male = window.speechSynthesis.getVoices().find((v) => /david|mark|daniel|google uk english male|alex/i.test(v.name));
        if (male) utt.voice = male;
        utt.onend = utt.onerror = () => { speechRef.current = false; setPs("idle"); };
        speechRef.current = true; window.speechSynthesis.speak(utt); setPs("playing");
      } else setPs("idle");
    }
  }, [ps, r, prev]);

  const pause = useCallback(() => {
    if (speechRef.current) window.speechSynthesis?.pause(); else audioRef.current?.pause();
    setPs("paused");
  }, []);

  const stop = useCallback(() => {
    if (speechRef.current) { window.speechSynthesis?.cancel(); speechRef.current = false; }
    else if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    setPs("idle");
  }, []);

  return { ps, play, pause, stop };
}

// ─── Arc Card (Opening / Closing / #1 Fix as visual tiles) ─────────────────

function ArcCard({
  index, label, body, accent, scoreLabel, scoreColor, isPriority,
}: {
  index: string;
  label: string;
  body: string;
  accent: string;
  scoreLabel?: string;
  scoreColor?: string;
  isPriority?: boolean;
}) {
  return (
    <div style={{
      position: "relative",
      padding: "16px 18px 18px",
      borderRadius: 10,
      background: isPriority
        ? "linear-gradient(180deg, rgba(248,113,113,0.06), rgba(248,113,113,0.02))"
        : "rgba(255,255,255,0.025)",
      border: `1px solid ${isPriority ? "rgba(248,113,113,0.28)" : "rgba(255,255,255,0.08)"}`,
      borderLeft: `3px solid ${accent}`,
    }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{
            fontFamily: '"Instrument Serif", Georgia, serif', fontStyle: "italic",
            fontSize: 20, color: accent, lineHeight: 1, letterSpacing: "-0.02em",
          }}>
            {index}.
          </span>
          <span style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 10, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.28em", color: isPriority ? "#F87171" : "#A6B3C9",
          }}>
            {label}
          </span>
        </div>
        {scoreLabel && scoreColor && (
          <span style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 9, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.16em",
            padding: "3px 8px", borderRadius: 999,
            background: `${scoreColor}1F`,
            color: scoreColor, border: `1px solid ${scoreColor}50`,
          }}>
            {scoreLabel}
          </span>
        )}
      </div>
      <p style={{
        fontFamily: '"Instrument Serif", Georgia, serif', fontSize: 16,
        color: "#ECF1FA", lineHeight: 1.5, margin: 0, letterSpacing: "-0.005em",
      }}>
        {body}
      </p>
    </div>
  );
}

// ─── Insight Card (visual replacement for text-bullet feedback items) ─────

function InsightCard({
  accent, label, body, ts, index,
}: {
  accent: string;
  label: string;
  body: string;
  ts: string | null;
  index: number;
}) {
  // Drop a thin colored accent bar on the left, big bold title (the label),
  // compact body text, optional timestamp pin in the corner. Reads as a
  // tile, not a paragraph — users can scan the whole list in 2-3 seconds
  // before deciding which ones to deep-read.
  return (
    <div style={{
      position: "relative",
      padding: "12px 14px 14px 18px",
      borderRadius: 8,
      background: "rgba(255,255,255,0.025)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderLeft: `3px solid ${accent}`,
    }}>
      {ts && (
        <span style={{
          position: "absolute", top: 10, right: 12,
          fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
          color: accent, opacity: 0.85, letterSpacing: "0.04em",
        }}>
          {ts}
        </span>
      )}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: label && body ? 6 : 0, paddingRight: ts ? 56 : 0 }}>
        <span style={{
          fontFamily: '"JetBrains Mono", monospace', fontSize: 9, fontWeight: 700,
          color: "#4D5876", letterSpacing: "0.16em",
        }}>
          0{index}
        </span>
        <span style={{
          fontWeight: 600, fontSize: 14, color: accent, lineHeight: 1.3,
          letterSpacing: "-0.005em",
        }}>
          {label || body}
        </span>
      </div>
      {label && body && (
        <p style={{
          fontSize: 13, color: "#A6B3C9", lineHeight: 1.55,
          margin: 0, paddingLeft: 22,
        }}>
          {body}
        </p>
      )}
    </div>
  );
}

// ─── Unlock Stat (count + label tile) ───────────────────────────────────────

function UnlockStat({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontSize: 32, lineHeight: 1, color, letterSpacing: "-0.02em", marginBottom: 6 }}>
        +{n}
      </div>
      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: "#A6B3C9", lineHeight: 1.4, letterSpacing: "0.02em" }}>
        {label}
      </div>
    </div>
  );
}

// ─── Locked Section ───────────────────────────────────────────────────────────

function LockedSection({
  label,
  hint,
  height = 120,
  onUpgrade,
}: {
  label: string;
  hint?: string;
  height?: number;
  onUpgrade: () => void;
}) {
  return (
    <div style={{ borderRadius: 10, overflow: "hidden", position: "relative", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div style={{ minHeight: height, padding: "18px 20px", filter: "blur(5px)", opacity: 0.4, pointerEvents: "none" }}>
        <p style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, textTransform: "uppercase", letterSpacing: "0.28em", color: "#6F7C95", marginBottom: 8 }}>{label}</p>
        <p style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontSize: 17, color: "#A6B3C9", lineHeight: 1.5 }}>Detailed coaching insight available. Includes specific timestamps and actionable guidance.</p>
      </div>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "0 20px", textAlign: "center", background: "linear-gradient(180deg, rgba(10,9,20,0.5) 0%, rgba(10,9,20,0.88) 100%)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Lock size={12} style={{ color: "#a78bfa" }} />
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#a78bfa" }}>{label}</span>
        </div>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.5, maxWidth: "36ch" }}>
          {hint ?? "Pro unlocks the full report — every fix, every mission, every flagged moment."}
        </p>
        <button
          onClick={onUpgrade}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, padding: "8px 18px", borderRadius: 8, background: "rgba(139,92,246,0.18)", border: "1px solid rgba(167,139,250,0.4)", color: "#c4b5fd", cursor: "pointer" }}
        >
          Unlock with Pro · $9.99/mo
        </button>
      </div>
    </div>
  );
}

// ─── Circular Dial ────────────────────────────────────────────────────────────

function CircularDial({ score, displayScore, draw }: { score: number; displayScore: number; draw: boolean }) {
  const color = scoreColor(displayScore);
  const rest = 100 - score;
  return (
    <div
      className={`cr2-dial${draw ? " draw" : ""}`}
      style={{ "--ring-rest": rest, "--ring-color": color } as React.CSSProperties}
    >
      <svg viewBox="0 0 200 200" aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}>
        <defs>
          <filter id="cr2-wobble" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="3" />
            <feDisplacementMap in="SourceGraphic" scale="1.6" />
          </filter>
        </defs>
        <g transform="translate(100 100)">
          <line x1="0" y1="-92" x2="0" y2="-84" stroke="#4D5876" strokeWidth="1.5" opacity="0.9" />
          <line x1="65.05" y1="-65.05" x2="60.81" y2="-60.81" stroke="#4D5876" strokeWidth="1" opacity="0.7" />
          <line x1="92" y1="0" x2="84" y2="0" stroke="#4D5876" strokeWidth="1.5" opacity="0.9" />
          <line x1="65.05" y1="65.05" x2="60.81" y2="60.81" stroke="#4D5876" strokeWidth="1" opacity="0.7" />
          <line x1="0" y1="92" x2="0" y2="84" stroke="#4D5876" strokeWidth="1.5" opacity="0.9" />
          <line x1="-65.05" y1="65.05" x2="-60.81" y2="60.81" stroke="#4D5876" strokeWidth="1" opacity="0.7" />
          <line x1="-92" y1="0" x2="-84" y2="0" stroke="#4D5876" strokeWidth="1.5" opacity="0.9" />
          <line x1="-65.05" y1="-65.05" x2="-60.81" y2="-60.81" stroke="#4D5876" strokeWidth="1" opacity="0.7" />
        </g>
        <circle
          cx="100" cy="100" r="86"
          transform="rotate(-90 100 100)"
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="1.5"
          strokeDasharray="4 5"
          strokeLinecap="round"
          pathLength={100}
        />
        <circle
          className="cr2-ring-fill"
          cx="100" cy="100" r="86"
          transform="rotate(-90 100 100)"
          fill="none"
          strokeWidth="3"
          strokeDasharray="7 5"
          strokeLinecap="round"
          pathLength={100}
          filter="url(#cr2-wobble)"
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: '"Instrument Serif", Georgia, serif', color }}>
        <span style={{ fontSize: 108, lineHeight: 1, letterSpacing: "-0.06em", fontVariantNumeric: "tabular-nums", transform: "translateY(-4px)" }}>{displayScore}</span>
        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: "#6F7C95", letterSpacing: "0.12em", marginTop: -8 }}>/ 100</span>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  gaming: "Gaming", just_chatting: "Just Chatting", irl: "IRL", variety: "Variety", educational: "Educational",
};

const ANTI_PATTERN_LABELS: Record<string, string> = {
  viewer_count_apology: "Viewer Count Apology",
  follow_begging: "Follow Begging",
  lurker_shaming: "Lurker Shaming",
  pre_stream_drain: "Pre-Stream Drain",
  self_defeat: "Self-Defeat Talk",
};

const ROMAN = ["i.", "ii.", "iii.", "iv.", "v."];

interface ChatPulseBucket {
  start: number; end: number; count: number; uniqueChatters: number;
  laughCount: number; hypeCount: number; sadCount: number;
  subEvents: number; bitEvents: number; raidEvents: number; vibe: number;
  // New fields — older bucketed data may not have them; handle as optional in UI.
  velocity?: number;
  diversity?: number;
  hypeRatio?: number;
  dominantSignal?: "laughs" | "hype" | "sad" | "monetary" | "neutral";
}

export function CoachReportCard({
  report, previousScore, previousReport, streak = 0, isPersonalBest = false, streamerTitle, isPro = true, streamDurationSeconds, chatPulse, trajectory, wordTimestamps,
}: {
  report: CoachReport;
  previousScore?: number;
  previousReport?: CoachReport;
  streak?: number;
  isPersonalBest?: boolean;
  streamerTitle?: string;
  isPro?: boolean;
  streamDurationSeconds?: number;
  chatPulse?: ChatPulseBucket[] | null;
  trajectory?: TrajectoryPoint[];
  /** Optional word-level timestamps from Deepgram. Used to build the
   *  per-minute energy curve overlaid on the Silence Map. */
  wordTimestamps?: Array<{ start: number; end: number }> | null;
}) {
  const { ps, play, pause, stop } = useAudio(report, previousScore);
  const delta = previousScore !== undefined ? report.overall_score - previousScore : null;

  const [displayScore, setDisplayScore] = useState(0);
  const [draw, setDraw] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const openUpgrade = useCallback(() => setUpgradeOpen(true), []);

  // Concrete unlock counts — used in CTA copy so free users see what
  // they're actually missing in THIS report, not a generic feature list.
  const lockedStrengths = Math.max(0, (report.strengths?.length ?? 0) - 1);
  const fixCount = report.improvements?.length ?? 0;
  const missionCount = report.next_stream_goals?.length ?? 0;
  const antiPatternCount = report.anti_patterns?.length ?? 0;

  // Longitudinal recap — only when we have a prior stream's full report
  // to compare against. This is the "we remember what you tried" moment
  // that proves LevlCast isn't a one-shot wrapper.
  const recapDelta = previousReport ? computeReportDelta(previousReport, report) : null;

  useEffect(() => {
    const target = report.overall_score;
    const duration = 1800;
    let start: number | null = null;
    let raf: number;
    function ease(t: number) { return 1 - Math.pow(1 - t, 3); }
    const timeout = setTimeout(() => {
      setDraw(true);
      function tick(now: number) {
        if (!start) start = now;
        const t = Math.min(1, (now - start) / duration);
        setDisplayScore(Math.round(ease(t) * target));
        if (t < 1) raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);
    }, 200);
    return () => { clearTimeout(timeout); cancelAnimationFrame(raf); };
  }, [report.overall_score]);

  const gaps = report.dead_zones ?? [];
  // Per-minute WPM curve from word-level timestamps. Each bucket = 1
  // minute of stream time. Used as an overlay on the Silence Map so the
  // user sees not just WHERE silence was but HOW HARD they spoke during
  // active windows. Falls through silently when wordTimestamps absent.
  const wpmCurve: number[] = (() => {
    if (!wordTimestamps || wordTimestamps.length === 0) return [];
    const lastEnd = wordTimestamps[wordTimestamps.length - 1].end ?? 0;
    const totalDur = streamDurationSeconds ?? lastEnd;
    if (totalDur <= 0) return [];
    const minutes = Math.max(1, Math.ceil(totalDur / 60));
    const counts = new Array(minutes).fill(0) as number[];
    for (const w of wordTimestamps) {
      if (typeof w.start !== "number" || w.start < 0) continue;
      const idx = Math.min(minutes - 1, Math.floor(w.start / 60));
      counts[idx]++;
    }
    return counts; // each entry = words spoken in that minute = WPM
  })();
  const totalSecs = streamDurationSeconds ??
    (gaps.length > 0 ? Math.max(...gaps.map(g => parseTimeSecs(g.time) + g.duration)) * 1.25 : 0);

  const energyLabel =
    report.energy_trend === "building" ? "Building Energy"
    : report.energy_trend === "declining" ? "Declining Energy"
    : report.energy_trend === "volatile" ? "Volatile Energy"
    : "Consistent Energy";

  const retLabel = `${report.viewer_retention_risk === "high" ? "High" : report.viewer_retention_risk === "medium" ? "Medium" : "Low"} Retention Risk`;

  const coldLabel = report.cold_open
    ? report.cold_open.score === "strong" ? "Strong Open"
      : report.cold_open.score === "average" ? "Slow Start"
      : "Cold Open"
    : null;

  function pillColor(val: string, good: string, bad: string) {
    if (val === good) return { border: "rgba(163,230,53,0.4)", color: "#A3E635" };
    if (val === bad) return { border: "rgba(248,113,113,0.4)", color: "#F87171" };
    return { border: "rgba(245,158,11,0.4)", color: "#F59E0B" };
  }

  const energyPill = pillColor(report.energy_trend, "building", "declining");
  const retPill = pillColor(report.viewer_retention_risk, "low", "high");
  const coldPill = report.cold_open ? pillColor(report.cold_open.score, "strong", "weak") : null;

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

      <style>{`
        .cr2-dial {
          position: relative; width: 240px; height: 240px; margin: 0 auto;
        }
        .cr2-ring-fill {
          stroke: var(--ring-color, #A3E635);
          stroke-dashoffset: 100;
          transition: stroke 600ms ease;
        }
        .cr2-dial.draw .cr2-ring-fill {
          animation: cr2-draw 1800ms cubic-bezier(.2,.7,.2,1) 200ms forwards;
        }
        @keyframes cr2-draw {
          from { stroke-dashoffset: 100; }
          to { stroke-dashoffset: var(--ring-rest, 72); }
        }
        .cr2-ruler {
          margin: 28px 0; text-align: center;
          color: #4D5876; font-family: "JetBrains Mono", monospace;
          font-size: 10px; letter-spacing: 0.4em;
          position: relative; text-transform: uppercase;
        }
        .cr2-ruler::before, .cr2-ruler::after {
          content: ""; position: absolute; top: 50%;
          width: calc(50% - 56px); height: 1px; background: rgba(255,255,255,0.07);
        }
        .cr2-ruler::before { left: 0; }
        .cr2-ruler::after { right: 0; }
        .cr2-tl-gap {
          position: absolute; top: 0; bottom: 0;
          background: repeating-linear-gradient(135deg, rgba(248,113,113,0.18) 0, rgba(248,113,113,0.18) 6px, transparent 6px, transparent 11px);
          border-left: 1px dashed rgba(248,113,113,0.7);
          border-right: 1px dashed rgba(248,113,113,0.7);
        }
        .cr2-tl-gap.hot {
          background: repeating-linear-gradient(135deg, rgba(245,158,11,0.32) 0, rgba(245,158,11,0.32) 6px, transparent 6px, transparent 11px);
          border-color: #F59E0B;
        }
        .cr2-check {
          width: 22px; height: 22px; border: 1.5px solid #4D5876; border-radius: 4px;
          cursor: pointer; transition: all .15s ease; flex-shrink: 0;
          position: relative; background: transparent; appearance: none; -webkit-appearance: none;
        }
        .cr2-check.done {
          background: #22D3EE; border-color: #22D3EE;
          box-shadow: 0 0 12px rgba(34,211,238,0.5);
        }
        .cr2-check.done::after {
          content: "✓"; position: absolute; inset: 0;
          display: grid; place-items: center;
          color: #001318; font-size: 13px; font-weight: 700;
        }
        @media (max-width: 640px) {
          .cr2-hero { grid-template-columns: 1fr !important; }
          .cr2-dial { width: 200px !important; height: 200px !important; }
          .cr2-subs { grid-template-columns: repeat(2, 1fr) !important; }
          .cr2-two { grid-template-columns: 1fr !important; }
          .cr2-two-divider { display: none !important; }
        }
      `}</style>

      <div style={{
        background: "#0C111C",
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.07)",
        color: "#ECF1FA",
        WebkitFontSmoothing: "antialiased",
        backgroundImage: "radial-gradient(900px 500px at 80% -100px, rgba(34,211,238,0.06), transparent 60%), radial-gradient(700px 400px at 0% 30%, rgba(163,230,53,0.03), transparent 60%)",
      }}>
        <div style={{ padding: "32px 28px 48px" }}>

          {/* ── MASTHEAD ── */}
          <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.07)", marginBottom: 28, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, letterSpacing: "0.32em", textTransform: "uppercase", color: "#6F7C95", marginBottom: 4 }}>
                Stream Debrief
              </div>
              <h1 style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontWeight: 400, fontSize: 34, lineHeight: 1.05, letterSpacing: "-0.01em", color: "#ECF1FA", margin: 0 }}>
                {report.streamer_type ? TYPE_LABELS[report.streamer_type] ?? "Stream" : "Stream"}{" "}
                <em style={{ fontStyle: "italic", color: "#22D3EE" }}>Coaching</em>
              </h1>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {streamerTitle && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 9px", border: "1px solid rgba(34,211,238,0.32)", borderRadius: 4, background: "rgba(34,211,238,0.06)", color: "#22D3EE", fontSize: 11, fontFamily: '"JetBrains Mono", monospace' }}>
                    ◆ {streamerTitle}
                  </span>
                )}
                {streak >= 2 && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 9px", border: "1px solid rgba(245,158,11,0.32)", borderRadius: 4, background: "rgba(245,158,11,0.06)", color: "#F59E0B", fontSize: 11, fontFamily: '"JetBrains Mono", monospace' }}>
                    ▲ {streak}-stream streak
                  </span>
                )}
              </div>
              {/* Audio */}
              <div>
                {ps === "idle" && (
                  <button onClick={play} style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, letterSpacing: "0.1em", color: "#6F7C95", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 4, padding: "3px 10px", cursor: "pointer" }}>
                    ▶ Quick Listen
                  </button>
                )}
                {ps === "loading" && <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: "#6F7C95" }}>Loading…</span>}
                {(ps === "playing" || ps === "paused") && (
                  <span style={{ display: "inline-flex", gap: 4 }}>
                    <button onClick={ps === "playing" ? pause : play} style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: "#6F7C95", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 4, padding: "3px 8px", cursor: "pointer" }}>
                      {ps === "playing" ? "⏸" : "▶"}
                    </button>
                    <button onClick={stop} style={{ fontSize: 10, color: "#4D5876", background: "transparent", border: "none", cursor: "pointer" }}>✕</button>
                  </span>
                )}
              </div>
            </div>
          </header>

          {/* ── HERO: DIAL + STORY ── */}
          <section className="cr2-hero" style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 40, alignItems: "start", marginBottom: 32 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, letterSpacing: "0.32em", textTransform: "uppercase", color: "#6F7C95", marginBottom: 14, textAlign: "left" }}>
                Performance Score
              </div>
              <CircularDial score={report.overall_score} displayScore={displayScore} draw={draw} />
              {/* Delta */}
              <div style={{
                marginTop: 16, fontFamily: '"Instrument Serif", Georgia, serif', fontSize: 20,
                color: delta !== null && delta > 0 ? "#A3E635" : delta !== null && delta < 0 ? "#F87171" : "#6F7C95",
                fontStyle: "italic", display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                opacity: draw ? 1 : 0, transform: draw ? "translateY(0)" : "translateY(4px)",
                transition: "opacity 500ms ease 1.5s, transform 500ms ease 1.5s",
              }}>
                {delta !== null
                  ? <>{delta > 0 ? "↗" : delta < 0 ? "↘" : "→"} {delta > 0 ? `+${delta}` : delta} from last stream</>
                  : <span style={{ fontSize: 13, color: "#4D5876" }}>First report</span>
                }
              </div>
              {/* Pills */}
              <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999, fontSize: 11, border: `1px solid ${energyPill.border}`, color: energyPill.color, fontFamily: "system-ui, sans-serif" }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />{energyLabel}
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999, fontSize: 11, border: `1px solid ${retPill.border}`, color: retPill.color, fontFamily: "system-ui, sans-serif" }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />{retLabel}
                </span>
                {coldLabel && coldPill && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999, fontSize: 11, border: `1px solid ${coldPill.border}`, color: coldPill.color, fontFamily: "system-ui, sans-serif" }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />{coldLabel}
                  </span>
                )}
              </div>
              {isPersonalBest && draw && (
                <div style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 7, padding: "4px 12px", borderRadius: 999, background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.35)", color: "#fbbf24", fontSize: 10, fontFamily: '"JetBrains Mono", monospace', letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  ★ New Personal Best
                </div>
              )}
            </div>

            <div style={{ paddingTop: 6 }}>
              <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, letterSpacing: "0.32em", textTransform: "uppercase", color: "#6F7C95", marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 24, height: 1, background: "#4D5876", display: "inline-block" }} />
                The Story of This Stream
              </div>
              {report.stream_story ? (
                <p style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontSize: 18, lineHeight: 1.5, color: "#ECF1FA", letterSpacing: "-0.005em" }}>
                  {report.stream_story}
                </p>
              ) : (
                <p style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontSize: 18, lineHeight: 1.5, color: "#A6B3C9", fontStyle: "italic" }}>
                  Score: {report.overall_score}/100
                </p>
              )}
            </div>
          </section>

          {/* ── LAST STREAM RECAP ── (only when prior data exists) */}
          {recapDelta && <LastStreamRecap delta={recapDelta} />}

          {/* ── SCORE TRAJECTORY ── (line chart of last N streams) */}
          {trajectory && trajectory.length >= 2 && <ScoreTrajectory points={trajectory} />}


          {/* ── OPENING / CLOSING / #1 FIX ── as a card grid ──
              Replaces the row-style Roman-numeral list with three visual
              cards. Opening + Closing get score badges (Strong / Average /
              Weak); #1 Fix gets a danger accent. Scannable at a glance. */}
          {(report.cold_open?.note || report.closing?.note || (isPro && report.recommendation)) && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, margin: "0 0 32px" }}>
              {report.cold_open?.note && (
                <ArcCard
                  index="i"
                  label="Opening"
                  scoreLabel={report.cold_open.score === "strong" ? "Strong" : report.cold_open.score === "weak" ? "Weak" : "Average"}
                  scoreColor={report.cold_open.score === "strong" ? "#A3E635" : report.cold_open.score === "weak" ? "#F87171" : "#F59E0B"}
                  body={report.cold_open.note}
                  accent="#22D3EE"
                />
              )}
              {report.closing?.note && (
                <ArcCard
                  index="ii"
                  label="Closing"
                  scoreLabel={report.closing.score === "strong" ? "Strong" : report.closing.score === "weak" ? "Weak" : "Average"}
                  scoreColor={report.closing.score === "strong" ? "#A3E635" : report.closing.score === "weak" ? "#F87171" : "#F59E0B"}
                  body={report.closing.note}
                  accent="#22D3EE"
                />
              )}
              {isPro && report.recommendation && (
                <ArcCard
                  index="iii"
                  label="The #1 Fix"
                  body={report.recommendation}
                  accent="#F87171"
                  isPriority
                />
              )}
            </div>
          )}

          {/* Free-tier #1 Priority placeholder — sits inline where the card
              grid above would put it for a Pro user, so layout stays balanced. */}
          {!isPro && (
            <div style={{ marginTop: 8 }}>
              <LockedSection
                label="#1 Priority Fix"
                hint="Pro reveals the single most important fix to make next stream — pulled from this report's biggest weakness."
                height={110}
                onUpgrade={openUpgrade}
              />
            </div>
          )}

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", margin: "32px 0 28px" }} />

          {/* ── WHAT WORKED / FIX FOR NEXT ── */}
          {((report.strengths ?? []).length > 0 || (report.improvements ?? []).length > 0) && (
            <div className="cr2-two" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, marginBottom: 36 }}>

              {/* What Worked — visual insight cards */}
              <div>
                <h2 style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontWeight: 400, fontSize: 26, letterSpacing: "-0.01em", marginBottom: 4, color: "#ECF1FA" }}>
                  What <em style={{ fontStyle: "italic", color: "#A3E635" }}>worked.</em>
                </h2>
                <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", color: "#6F7C95", marginBottom: 16 }}>Keep doing these</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {(isPro ? (report.strengths ?? []) : (report.strengths ?? []).slice(0, 1)).map((s, i) => {
                    const { label, body, ts } = parseItem(s);
                    return <InsightCard key={i} accent="#A3E635" label={label} body={body} ts={ts} index={i + 1} />;
                  })}
                </div>
                {!isPro && (report.strengths ?? []).length > 1 && (
                  <button
                    onClick={openUpgrade}
                    style={{
                      fontSize: 11, fontFamily: '"JetBrains Mono", monospace',
                      color: "#a78bfa", paddingLeft: 4, marginTop: 12,
                      background: "transparent", border: "none", cursor: "pointer",
                      textDecoration: "underline", letterSpacing: "0.04em",
                    }}
                  >
                    + {(report.strengths ?? []).length - 1} more strength{(report.strengths ?? []).length - 1 !== 1 ? "s" : ""} — unlock with Pro
                  </button>
                )}
              </div>

              {/* Fix for Next — visual insight cards */}
              {isPro ? (
                <div>
                  <h2 style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontWeight: 400, fontSize: 26, letterSpacing: "-0.01em", marginBottom: 4, color: "#ECF1FA" }}>
                    What to <em style={{ fontStyle: "italic", color: "#F59E0B" }}>fix.</em>
                  </h2>
                  <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", color: "#6F7C95", marginBottom: 16 }}>Change these next time</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {(report.improvements ?? []).map((s, i) => {
                      const { label, body, ts } = parseItem(s);
                      return <InsightCard key={i} accent="#F59E0B" label={label} body={body} ts={ts} index={i + 1} />;
                    })}
                  </div>
                </div>
              ) : (
                <div>
                  <h2 style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontWeight: 400, fontSize: 26, letterSpacing: "-0.01em", marginBottom: 20, color: "#ECF1FA" }}>
                    What to <em style={{ fontStyle: "italic", color: "#F59E0B" }}>fix.</em>
                  </h2>
                  <LockedSection
                    label={fixCount > 0 ? `${fixCount} Specific Fix${fixCount !== 1 ? "es" : ""}` : "Fix For Next"}
                    hint={fixCount > 0
                      ? `${fixCount} actionable fix${fixCount !== 1 ? "es" : ""} for next stream — with timestamps and specific moments to change.`
                      : undefined}
                    height={140}
                    onUpgrade={openUpgrade}
                  />
                </div>
              )}
            </div>
          )}

          {/* ── GROWTH KILLERS ── */}
          {isPro && (report.anti_patterns ?? []).length > 0 && (
            <div style={{ margin: "0 0 36px", padding: "22px 24px", borderRadius: 10, background: "rgba(248,113,113,0.04)", border: "1px solid rgba(248,113,113,0.18)" }}>
              <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 9, letterSpacing: "0.36em", textTransform: "uppercase", color: "#F87171", marginBottom: 20 }}>
                Growth Killers Flagged
              </div>
              {(report.anti_patterns ?? []).map((ap, i, arr) => (
                <div key={i} style={{ paddingBottom: i < arr.length - 1 ? 20 : 0, marginBottom: i < arr.length - 1 ? 20 : 0, borderBottom: i < arr.length - 1 ? "1px dashed rgba(248,113,113,0.18)" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, fontWeight: 700, color: "#F87171", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                      {ANTI_PATTERN_LABELS[ap.type] ?? ap.type}
                    </span>
                    <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: "#6F7C95" }}>{ap.time}</span>
                  </div>
                  <p style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, color: "rgba(248,113,113,0.75)", lineHeight: 1.55, margin: "0 0 10px", padding: "8px 14px", background: "rgba(248,113,113,0.07)", borderRadius: 6, borderLeft: "2px solid rgba(248,113,113,0.45)" }}>
                    &ldquo;{ap.quote}&rdquo;
                  </p>
                  <p style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontStyle: "italic", fontSize: 14, color: "#A6B3C9", lineHeight: 1.55, margin: 0 }}>
                    {ap.note}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* ── MISSIONS ── GATED */}
          {(report.next_stream_goals ?? []).length > 0 && (
            isPro ? (
              <div style={{ margin: "32px 0 24px", padding: "22px 0 12px", borderTop: "1px solid rgba(255,255,255,0.07)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <h2 style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontWeight: 400, fontSize: 28, letterSpacing: "-0.015em", marginBottom: 4, color: "#ECF1FA" }}>
                  Missions for <em style={{ fontStyle: "italic", color: "#22D3EE" }}>next stream.</em>
                </h2>
                <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", color: "#6F7C95", marginBottom: 20 }}>
                  Click to mark as committed
                </div>
                {(report.next_stream_goals ?? []).map((goal, i, arr) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "44px 1fr 28px", gap: 12, alignItems: "start", padding: "13px 0", borderBottom: i < arr.length - 1 ? "1px dashed rgba(255,255,255,0.12)" : "none" }}>
                    <div style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontStyle: "italic", fontSize: 28, color: "#22D3EE", letterSpacing: "-0.03em", lineHeight: 0.9 }}>
                      {ROMAN[i] ?? `${i + 1}.`}
                    </div>
                    <p style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontSize: 17, lineHeight: 1.45, color: checked.has(i) ? "#6F7C95" : "#ECF1FA" }}>
                      {goal}
                    </p>
                    <button
                      className={`cr2-check${checked.has(i) ? " done" : ""}`}
                      onClick={() => setChecked(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; })}
                      aria-label={`Mark mission ${i + 1} as done`}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ margin: "28px 0" }}>
                <LockedSection
                  label={`Your Missions · ${missionCount} next-stream goal${missionCount !== 1 ? "s" : ""}`}
                  hint={missionCount > 0
                    ? `${missionCount} concrete mission${missionCount !== 1 ? "s" : ""} to commit to before your next stream — checkable, trackable, built from this stream's data.`
                    : undefined}
                  height={140}
                  onUpgrade={openUpgrade}
                />
              </div>
            )
          )}

          {/* ── STREAM TIMELINE ── unified silence + chat pulse ── */}
          {(gaps.length > 0 || (chatPulse && chatPulse.length > 0)) && totalSecs > 0 && (
            <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.07)" }}>

              {/* Header */}
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
                <h2 style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontWeight: 400, fontSize: 28, letterSpacing: "-0.015em", lineHeight: 1, margin: 0, color: "#ECF1FA" }}>
                  Stream <em style={{ fontStyle: "italic", color: "#a78bfa" }}>Timeline.</em>
                </h2>
                {chatPulse && chatPulse.length > 0 && isPulseViable(chatPulse as Parameters<typeof isPulseViable>[0]) && (() => {
                  const total = chatPulse.reduce((s, b) => s + b.count, 0);
                  const laughs = chatPulse.reduce((s, b) => s + b.laughCount, 0);
                  const hype = chatPulse.reduce((s, b) => s + b.hypeCount, 0);
                  const subs = chatPulse.reduce((s, b) => s + b.subEvents, 0);
                  const raids = chatPulse.reduce((s, b) => s + b.raidEvents, 0);
                  return (
                    <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, letterSpacing: "0.12em", color: "#6F7C95" }}>
                      {total.toLocaleString()} messages
                      {laughs > 0 && <> · <span style={{ color: "#A3E635" }}>{laughs} laughs</span></>}
                      {hype > 0 && <> · <span style={{ color: "#A3E635" }}>{hype} hype</span></>}
                      {subs > 0 && <> · <span style={{ color: "#a78bfa" }}>{subs} subs</span></>}
                      {raids > 0 && <> · <span style={{ color: "#F59E0B" }}>{raids} raids</span></>}
                    </div>
                  );
                })()}
              </div>

              {/* Visualization stack */}
              <div style={{ position: "relative" }}>

                {/* Chat pulse bars — rendered directly above the silence track */}
                {chatPulse && chatPulse.length > 0 && isPulseViable(chatPulse as Parameters<typeof isPulseViable>[0]) && (() => {
                  const peak = chatPulse.reduce((m, b) => (b.count > m ? b.count : m), 0);
                  return (
                    <div style={{
                      position: "relative", height: 72, marginBottom: 0,
                      background: "rgba(255,255,255,0.015)",
                      borderTop: "1px solid rgba(255,255,255,0.06)",
                      display: "flex", alignItems: "flex-end", gap: 1,
                    }}>
                      {chatPulse.map((b, i) => {
                        const heightPct = peak > 0 ? Math.max(2, (b.count / peak) * 100) : 0;
                        const widthPct = 100 / chatPulse.length;
                        const color = (() => {
                          if (b.count === 0) return "rgba(255,255,255,0.05)";
                          const positive = b.laughCount + b.hypeCount;
                          const tot = positive + b.sadCount;
                          if (tot === 0) return "rgba(167,139,250,0.5)";
                          const posShare = positive / tot;
                          if (posShare >= 0.65) return "#A3E635";
                          if (posShare <= 0.35) return "#F87171";
                          return "rgba(167,139,250,0.5)";
                        })();
                        return (
                          <div key={i} style={{
                            flex: `0 0 ${widthPct}%`, height: `${heightPct}%`,
                            background: color, opacity: 0.72,
                            borderRadius: "2px 2px 0 0",
                          }} />
                        );
                      })}
                      {/* Sub/bits/raid event dots */}
                      {chatPulse.map((b, i) => {
                        const hasEvent = b.subEvents > 0 || b.bitEvents > 0 || b.raidEvents > 0;
                        if (!hasEvent) return null;
                        const pct = ((b.start + (b.end - b.start) / 2) / totalSecs) * 100;
                        const color = b.raidEvents > 0 ? "#F59E0B" : b.bitEvents > 0 ? "#22D3EE" : "#a78bfa";
                        return (
                          <div key={`evt-${i}`} title={
                            (b.raidEvents > 0 ? "Raid · " : "") +
                            (b.subEvents > 0 ? `${b.subEvents} subs · ` : "") +
                            (b.bitEvents > 0 ? `${b.bitEvents} bits · ` : "")
                          } style={{
                            position: "absolute", top: 5, left: `${pct}%`,
                            width: 6, height: 6, borderRadius: "50%",
                            background: color, transform: "translateX(-50%)",
                            border: "1px solid rgba(10,9,20,0.9)",
                          }} />
                        );
                      })}
                    </div>
                  );
                })()}

                {/* WPM energy curve — voice intensity overlay */}
                {wpmCurve.length >= 3 && (() => {
                  const maxWpm = Math.max(...wpmCurve);
                  if (maxWpm <= 0) return null;
                  const peakColor = "#22D3EE";
                  const W = 1000; const H = 40;
                  const xFor = (i: number) => wpmCurve.length === 1 ? W / 2 : (i / (wpmCurve.length - 1)) * W;
                  const yFor = (v: number) => H - (v / maxWpm) * (H - 4) - 2;
                  const pts = wpmCurve.map((v, i) => [xFor(i), yFor(v)] as const);
                  let line = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
                  for (let i = 0; i < pts.length - 1; i++) {
                    const [x0, y0] = pts[i]; const [x1, y1] = pts[i + 1];
                    const cx = (x0 + x1) / 2;
                    line += ` C ${cx.toFixed(1)} ${y0.toFixed(1)}, ${cx.toFixed(1)} ${y1.toFixed(1)}, ${x1.toFixed(1)} ${y1.toFixed(1)}`;
                  }
                  const area = line + ` L ${W} ${H} L 0 ${H} Z`;
                  return (
                    <div style={{ height: H, position: "relative", pointerEvents: "none" }}>
                      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H} style={{ display: "block" }}>
                        <defs>
                          <linearGradient id="energy-fill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={peakColor} stopOpacity="0.28" />
                            <stop offset="100%" stopColor={peakColor} stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <path d={area} fill="url(#energy-fill)" />
                        <path d={line} fill="none" stroke={peakColor} strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" opacity={0.6} />
                      </svg>
                    </div>
                  );
                })()}

                {/* Silence track — the gaps themselves */}
                <div style={{ position: "relative", height: 36, background: "rgba(255,255,255,0.025)", borderTop: "1px solid rgba(255,255,255,0.07)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  {/* Time markers + labels */}
                  {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                    const secs = Math.round(pct * totalSecs);
                    return (
                      <div key={i} style={{ position: "absolute", top: -4, bottom: -4, left: `${pct * 100}%`, width: 1, background: i % 2 === 0 ? "#4D5876" : "rgba(255,255,255,0.12)" }}>
                        <span style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, transform: "translateX(-50%)", fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: "#6F7C95", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                          {fmtTimestamp(secs)}
                        </span>
                      </div>
                    );
                  })}

                  {/* Silence gaps */}
                  {gaps.map((g, i) => {
                    const startPct = (parseTimeSecs(g.time) / totalSecs) * 100;
                    const widthPct = Math.max((g.duration / totalSecs) * 100, 0.8);
                    const isHot = g.duration >= 120;
                    return (
                      <div key={i} className={`cr2-tl-gap${isHot ? " hot" : ""}`} style={{ left: `${startPct}%`, width: `${widthPct}%` }}>
                        {isHot && (
                          <div style={{ position: "absolute", bottom: "calc(100% + 10px)", left: "50%", transform: "translateX(-50%)", textAlign: "center", whiteSpace: "nowrap", pointerEvents: "none" }}>
                            <div style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontStyle: "italic", fontSize: 14, color: "#F59E0B", lineHeight: 1 }}>{fmtDur(g.duration)}</div>
                            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: "#6F7C95", letterSpacing: "0.06em", marginTop: 2 }}>{g.time}</div>
                            <div style={{ width: 1, height: 7, background: "#4D5876", margin: "3px auto 0" }} />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Best moment marker */}
                  {report.best_moment && (() => {
                    const pct = (parseTimeSecs(report.best_moment.time) / totalSecs) * 100;
                    if (pct < 0 || pct > 100) return null;
                    return (
                      <div style={{ position: "absolute", top: -10, bottom: -10, left: `${pct}%`, width: 2, background: "#A3E635", boxShadow: "0 0 6px rgba(163,230,53,0.6)" }}>
                        <span style={{ position: "absolute", bottom: "calc(100% + 4px)", left: "50%", transform: "translateX(-50%)", fontFamily: '"Instrument Serif", Georgia, serif', fontStyle: "italic", fontSize: 12, color: "#A3E635", whiteSpace: "nowrap" }}>
                          Best moment
                        </span>
                      </div>
                    );
                  })()}

                  {/* Anti-pattern dots */}
                  {isPro && (report.anti_patterns ?? []).map((ap, i) => {
                    const secs = parseTimeSecs(ap.time);
                    const pct = (secs / totalSecs) * 100;
                    if (pct < 0 || pct > 100) return null;
                    return (
                      <div key={`ap-${i}`} title={`${ANTI_PATTERN_LABELS[ap.type] ?? ap.type} · ${ap.time}`} style={{
                        position: "absolute", top: -8, left: `${pct}%`,
                        width: 8, height: 8, borderRadius: "50%",
                        background: "#F87171", transform: "translateX(-50%)",
                        border: "2px solid rgba(10,9,20,0.85)",
                        boxShadow: "0 0 4px rgba(248,113,113,0.6)",
                      }} />
                    );
                  })}
                </div>

                {/* Legend */}
                <div style={{ marginTop: 24, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", fontFamily: '"JetBrains Mono", monospace', fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "#6F7C95" }}>
                  {gaps.length > 0 && (
                    <>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                        <span style={{ display: "inline-block", width: 24, height: 10, background: "repeating-linear-gradient(135deg, rgba(248,113,113,0.18) 0, rgba(248,113,113,0.18) 4px, transparent 4px, transparent 8px)", borderLeft: "1px dashed rgba(248,113,113,0.7)", borderRight: "1px dashed rgba(248,113,113,0.7)" }} />
                        Silence
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                        <span style={{ display: "inline-block", width: 24, height: 10, background: "repeating-linear-gradient(135deg, rgba(245,158,11,0.32) 0, rgba(245,158,11,0.32) 4px, transparent 4px, transparent 8px)", borderLeft: "1px dashed #F59E0B", borderRight: "1px dashed #F59E0B" }} />
                        Over 2 min
                      </span>
                    </>
                  )}
                  {report.best_moment && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                      <span style={{ display: "inline-block", width: 2, height: 14, background: "#A3E635", boxShadow: "0 0 5px rgba(163,230,53,0.6)" }} />
                      Best moment
                    </span>
                  )}
                  {isPro && (report.anti_patterns ?? []).length > 0 && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                      <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#F87171", boxShadow: "0 0 4px rgba(248,113,113,0.6)" }} />
                      Growth killer
                    </span>
                  )}
                  {chatPulse && chatPulse.length > 0 && isPulseViable(chatPulse as Parameters<typeof isPulseViable>[0]) && (
                    <>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                        <span style={{ display: "inline-block", width: 10, height: 10, background: "#A3E635", opacity: 0.72, borderRadius: 2 }} />
                        Chat hype
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                        <span style={{ display: "inline-block", width: 10, height: 10, background: "rgba(167,139,250,0.5)", borderRadius: 2 }} />
                        Chatter
                      </span>
                    </>
                  )}
                  {wpmCurve.length >= 3 && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                      <span style={{ display: "inline-block", width: 22, height: 8, background: "linear-gradient(180deg, rgba(34,211,238,0.4), rgba(34,211,238,0.05))", borderTop: "1px solid #22D3EE", borderRadius: 2 }} />
                      Words / min
                    </span>
                  )}
                </div>
              </div>

              {/* Summary stats row */}
              {gaps.length > 0 && (
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px dashed rgba(255,255,255,0.1)", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
                  <div>
                    <div style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontSize: 32, lineHeight: 1, letterSpacing: "-0.02em", color: "#F87171", marginBottom: 6 }}>
                      {fmtDur(gaps.reduce((s, g) => s + g.duration, 0))}
                    </div>
                    <div style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontStyle: "italic", fontSize: 13, color: "#6F7C95", lineHeight: 1.4 }}>Total silence.</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontSize: 32, lineHeight: 1, letterSpacing: "-0.02em", color: "#ECF1FA", marginBottom: 6 }}>{gaps.length}</div>
                    <div style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontStyle: "italic", fontSize: 13, color: "#6F7C95", lineHeight: 1.4 }}>Gaps — longest {fmtDur(Math.max(...gaps.map(g => g.duration)))}.</div>
                  </div>
                  {report.best_moment && (
                    <div>
                      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: "#A3E635", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>
                        Best · {report.best_moment.time}
                      </div>
                      <div style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontSize: 14, color: "#ECF1FA", lineHeight: 1.45 }}>
                        {report.best_moment.description}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── PRO UNLOCKS · CONCRETE COUNTS ── (free only) */}
          {!isPro && (
            <div style={{ marginTop: 40, padding: "26px 28px", borderRadius: 14, background: "linear-gradient(135deg, rgba(139,92,246,0.10), rgba(34,211,238,0.06))", border: "1px solid rgba(139,92,246,0.32)", position: "relative", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Lock size={11} style={{ color: "#c4b5fd" }} />
                <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#c4b5fd" }}>
                  Locked in this report
                </span>
              </div>
              <h3 style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontSize: 26, lineHeight: 1.15, color: "#ECF1FA", margin: 0, fontWeight: 400, letterSpacing: "-0.01em" }}>
                You&apos;re seeing the surface. <em style={{ fontStyle: "italic", color: "#c4b5fd" }}>Pro shows the rest.</em>
              </h3>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14, marginTop: 22, marginBottom: 22 }}>
                {fixCount > 0 && (
                  <UnlockStat n={fixCount} label={`Specific fix${fixCount !== 1 ? "es" : ""} for next stream`} color="#F59E0B" />
                )}
                {missionCount > 0 && (
                  <UnlockStat n={missionCount} label={`Mission${missionCount !== 1 ? "s" : ""} to commit to`} color="#22D3EE" />
                )}
                {antiPatternCount > 0 && (
                  <UnlockStat n={antiPatternCount} label={`Growth killer${antiPatternCount !== 1 ? "s" : ""} flagged`} color="#F87171" />
                )}
                {lockedStrengths > 0 && (
                  <UnlockStat n={lockedStrengths} label={`More strength${lockedStrengths !== 1 ? "s" : ""} to keep doing`} color="#A3E635" />
                )}
                <UnlockStat n={20} label="VOD analyses per month" color="#c4b5fd" />
                <UnlockStat n={20} label="Clips per month with captions" color="#c4b5fd" />
              </div>

              <p style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontStyle: "italic", fontSize: 15, color: "#A6B3C9", lineHeight: 1.5, margin: "0 0 18px" }}>
                One report tells you where you stand. The longitudinal track — score deltas across streams, recurring weaknesses, what you fixed and what you didn&apos;t — is where the actual coaching lives.
              </p>

              <button
                onClick={openUpgrade}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 10,
                  fontSize: 13, fontWeight: 700, padding: "11px 22px",
                  borderRadius: 10, border: "1px solid rgba(167,139,250,0.5)",
                  background: "rgba(139,92,246,0.22)", color: "#ECF1FA",
                  cursor: "pointer", letterSpacing: "0.01em",
                }}
              >
                Unlock Pro · $9.99/month <span style={{ color: "#c4b5fd", fontFamily: '"JetBrains Mono", monospace', fontSize: 11, fontWeight: 600 }}>cancel anytime</span>
              </button>
            </div>
          )}

          {/* ── COMEBACK HOOK ── (free only) */}
          {!isPro && (
            <div style={{ marginTop: 24, padding: "20px 24px", borderRadius: 12, background: "rgba(34,211,238,0.05)", border: "1px solid rgba(34,211,238,0.22)" }}>
              <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#22D3EE", marginBottom: 10 }}>
                What this report can&apos;t tell you yet
              </div>
              <p style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontSize: 17, color: "#ECF1FA", lineHeight: 1.5, margin: "0 0 6px" }}>
                Your <em style={{ fontStyle: "italic", color: "#22D3EE" }}>next stream</em> is the one that matters.
              </p>
              <p style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontStyle: "italic", fontSize: 14, color: "#A6B3C9", lineHeight: 1.55, margin: 0 }}>
                One report is a snapshot. The delta between this stream and your next is the proof. Track it, see what improved, see what didn&apos;t — that&apos;s how coaching actually works.
              </p>
            </div>
          )}

          {/* ── SIGNOFF ── */}
          <footer style={{ marginTop: 40, paddingTop: 22, borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24 }}>
            <div>
              <p style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontStyle: "italic", fontSize: 17, color: "#A6B3C9", lineHeight: 1.5 }}>
                Read once.<br />
                Stream once.<br />
                <strong style={{ color: "#ECF1FA", fontWeight: 400 }}>See you next time.</strong>
              </p>
              <p style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontStyle: "italic", fontSize: 28, color: "#A6B3C9", letterSpacing: "-0.02em", transform: "rotate(-2deg) translateX(-4px)", lineHeight: 1, marginTop: 12, display: "inline-block" }}>
                — LevlCast
              </p>
            </div>
            <div style={{ textAlign: "right", fontFamily: '"JetBrains Mono", monospace', fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "#4D5876", lineHeight: 1.8 }}>
              Coach Report<br />
              Stream Debrief
            </div>
          </footer>

        </div>
      </div>

      <UpgradeModal
        isOpen={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        reason="Unlock all fixes, missions, growth-killer flags, and 20 VOD analyses per month with full clip generation."
      />
    </>
  );
}
