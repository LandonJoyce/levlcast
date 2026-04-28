import Link from "next/link";
import NavBarLanding from "@/components/NavBarLanding";
import FooterLanding from "@/components/FooterLanding";
import FaqAccordion from "@/components/FaqAccordion";

/* ─── Icons (line, simple) ─── */
const ArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const CheckIcon = ({ color = "currentColor" }: { color?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M20 6L9 17l-5-5" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const TwitchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M4 5l2-3h14v12l-5 5h-4l-3 3H6v-3H2V8l2-3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
    <path d="M11 8v5M16 8v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
);
const SyncIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M3 12a9 9 0 0115-6.7L21 8M21 12a9 9 0 01-15 6.7L3 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M21 3v5h-5M3 21v-5h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const DocIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
    <path d="M14 3v6h6M8 13h8M8 17h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
);
const TrendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M3 17l6-6 4 4 8-8M14 7h7v7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const CoachIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/>
    <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
);
const ClipIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="6" cy="6" r="3" stroke="currentColor" strokeWidth="1.6"/>
    <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.6"/>
    <path d="M20 4L8.5 15.5M20 20L8.5 8.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
);
const PlayIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="6" width="18" height="12" rx="3" stroke="currentColor" strokeWidth="1.6"/>
    <path d="M11 10l4 2-4 2v-4z" fill="currentColor"/>
  </svg>
);
const AppleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M16.4 12.7c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.3 2.6 1.3-.1 1.8-.9 3.4-.9s2.1.9 3.4.8c1.4 0 2.3-1.2 3.2-2.5.8-1.1 1.2-2.2 1.5-3.4-2.1-.8-3.1-2.6-3.1-3.5zm-2.6-7.1c.7-.9 1.2-2.1 1.1-3.3-1 0-2.3.7-3 1.5-.6.7-1.2 2-1.1 3.2 1.1.1 2.3-.6 3-1.4z"/>
  </svg>
);

/* ─── Arc Gauge — kept for any remaining callers ─── */
function ArcGauge({ score, size = 180 }: { score: number; size?: number }) {
  const R = 70;
  const cx = 80;
  const cy = 90;
  const startAngle = -200;
  const sweep = 220;
  const polar = (angle: number, r: number = R) => {
    const rad = (angle * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const start = polar(startAngle);
  const end = polar(startAngle + sweep);
  const progEnd = polar(startAngle + (score / 100) * sweep);
  const largeArc = sweep > 180 ? 1 : 0;
  const progLarge = (score / 100) * sweep > 180 ? 1 : 0;
  const hex = score >= 75 ? "#4ade80" : score >= 50 ? "#facc15" : "#f87171";
  const fontSize = Math.round(size * 0.32);

  return (
    <div style={{ position: "relative", width: size, height: size * 0.72, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={size} height={size * 0.72} viewBox="0 0 160 120" style={{ position: "absolute", inset: 0 }}>
        <path d={`M ${start.x} ${start.y} A ${R} ${R} 0 ${largeArc} 1 ${end.x} ${end.y}`} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" strokeLinecap="round" />
        <path d={`M ${start.x} ${start.y} A ${R} ${R} 0 ${progLarge} 1 ${progEnd.x} ${progEnd.y}`} fill="none" stroke={hex} strokeWidth="6" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${hex})` }} />
        {[25, 50, 75].map((v) => {
          const a = startAngle + (v / 100) * sweep;
          const inner = polar(a, R - 10);
          const outer = polar(a, R - 4);
          return <line key={v} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" strokeLinecap="round" />;
        })}
      </svg>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: size * 0.08, position: "relative", zIndex: 1 }}>
        <span style={{ fontSize, fontWeight: 900, color: hex, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{score}</span>
        <span style={{ fontSize: Math.round(fontSize * 0.4), fontWeight: 700, color: "rgba(255,255,255,0.2)" }}>/100</span>
      </div>
    </div>
  );
}

/* ─── Static circular dial for landing page mocks ─── */
function StaticDial({ score, size = 200 }: { score: number; size?: number }) {
  const color = score >= 66 ? "#A3E635" : score >= 33 ? "#F59E0B" : "#F87171";
  const rest = 100 - score;
  return (
    <div style={{ position: "relative", width: size, height: size, margin: "0 auto" }}>
      <svg viewBox="0 0 200 200" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}>
        <g transform="translate(100 100)">
          <line x1="0" y1="-92" x2="0" y2="-84" stroke="#4D5876" strokeWidth="1.5" opacity="0.9" />
          <line x1="92" y1="0" x2="84" y2="0" stroke="#4D5876" strokeWidth="1.5" opacity="0.9" />
          <line x1="0" y1="92" x2="0" y2="84" stroke="#4D5876" strokeWidth="1.5" opacity="0.9" />
          <line x1="-92" y1="0" x2="-84" y2="0" stroke="#4D5876" strokeWidth="1.5" opacity="0.9" />
          <line x1="65.05" y1="-65.05" x2="60.81" y2="-60.81" stroke="#4D5876" strokeWidth="1" opacity="0.6" />
          <line x1="65.05" y1="65.05" x2="60.81" y2="60.81" stroke="#4D5876" strokeWidth="1" opacity="0.6" />
          <line x1="-65.05" y1="65.05" x2="-60.81" y2="60.81" stroke="#4D5876" strokeWidth="1" opacity="0.6" />
          <line x1="-65.05" y1="-65.05" x2="-60.81" y2="-60.81" stroke="#4D5876" strokeWidth="1" opacity="0.6" />
        </g>
        <circle cx="100" cy="100" r="86" transform="rotate(-90 100 100)" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" strokeDasharray="4 5" strokeLinecap="round" pathLength={100} />
        <circle cx="100" cy="100" r="86" transform="rotate(-90 100 100)" fill="none" stroke={color} strokeWidth="3" strokeDasharray="7 5" strokeLinecap="round" pathLength={100} strokeDashoffset={rest} style={{ filter: `drop-shadow(0 0 8px ${color}60)` }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color }}>
        <span style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontSize: Math.round(size * 0.46), lineHeight: 1, letterSpacing: "-0.06em" }}>{score}</span>
        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: "#6F7C95", letterSpacing: "0.12em", marginTop: -4 }}>/ 100</span>
      </div>
    </div>
  );
}

/* ─── Hero mock — compact editorial style matching new coach-report-card ─── */
function HeroMock() {
  return (
    <div style={{ borderRadius: 16, overflow: "hidden", background: "#0C111C", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 30px 80px -30px rgba(0,0,0,0.7)", backgroundImage: "radial-gradient(700px 400px at 80% -60px, rgba(34,211,238,0.06), transparent 60%)", fontFamily: "system-ui, sans-serif", color: "#ECF1FA", WebkitFontSmoothing: "antialiased" }}>
      {/* Masthead */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "16px 20px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 9, letterSpacing: "0.32em", textTransform: "uppercase", color: "#6F7C95", marginBottom: 3 }}>Stream Debrief</div>
          <div style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontSize: 22, lineHeight: 1, color: "#ECF1FA" }}>Gaming <em style={{ fontStyle: "italic", color: "#22D3EE" }}>Coaching</em></div>
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", border: "1px solid rgba(34,211,238,0.32)", borderRadius: 4, background: "rgba(34,211,238,0.06)", color: "#22D3EE", fontSize: 10, fontFamily: '"JetBrains Mono", monospace' }}>
          ◆ Consistent Creator
        </span>
      </div>

      {/* Dial + story */}
      <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 16, padding: "16px 20px" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 8, letterSpacing: "0.28em", textTransform: "uppercase", color: "#6F7C95", marginBottom: 8, textAlign: "left" }}>Score</div>
          <StaticDial score={67} size={160} />
          <div style={{ marginTop: 8, fontFamily: '"Instrument Serif", Georgia, serif', fontSize: 15, color: "#A3E635", fontStyle: "italic" }}>↗ +8 from last</div>
          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center" }}>
            {[["Building Energy","#A3E635","rgba(163,230,53,0.4)"],["Strong Open","#A3E635","rgba(163,230,53,0.4)"],["Low Risk","#A3E635","rgba(163,230,53,0.4)"]].map(([l,c,b]) => (
              <span key={l} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 7px", borderRadius: 999, fontSize: 10, border: `1px solid ${b}`, color: c }}>
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />{l}
              </span>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 9, letterSpacing: "0.28em", textTransform: "uppercase", color: "#6F7C95", marginBottom: 8 }}>— The Story</div>
          <p style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontSize: 15, lineHeight: 1.45, color: "#ECF1FA", margin: "0 0 14px" }}>
            Three solid hours on Elden Ring. You opened hot, dipped at 1:40 when chat went quiet, then recovered for your sharpest closing stretch of the week.
          </p>
          {/* #1 Fix row */}
          <div style={{ paddingLeft: 12, borderLeft: "2px solid #F87171", marginTop: 10 }}>
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 8, letterSpacing: "0.28em", textTransform: "uppercase", color: "#F87171", marginBottom: 4 }}>
              <span style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontStyle: "italic", fontSize: 16, color: "#F87171", marginRight: 6 }}>ii.</span>The #1 Fix
            </div>
            <p style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontSize: 14, lineHeight: 1.5, color: "#ECF1FA", margin: 0 }}>
              Narrate every clutch attempt out loud — set the tempo, don't match it.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Chat Pulse mock (used in §04 Chat Intelligence section) ─── */
function ChatPulseMock() {
  const serif = '"Instrument Serif", Georgia, serif';
  const mono  = '"JetBrains Mono", monospace';
  const ink   = "#ECF1FA";
  const ink2  = "#A6B3C9";
  const ink3  = "#6F7C95";
  const ink4  = "#4D5876";
  const line  = "rgba(255,255,255,0.07)";
  const lime  = "#A3E635";
  const amber = "#F59E0B";
  const rose  = "#F87171";
  const cyan  = "#22D3EE";

  // Bars: 0-100 relative chat volume, one per ~5-min bucket over a 3h+ stream
  const barData = [
    22, 30, 44, 50, 38, 24, 18, 20, 30, 50,  // 0–50 min opener + first hype
    62, 55, 42, 34, 24, 16, 12, 18, 28, 40,  // 50–100 min builds then quiet
    96, 90, 74, 56, 40, 28,  8,  6, 14, 22,  // 100–150 min clutch then crash
    32, 46, 54, 64, 74, 80, 86, 90, 76, 62,  // 150–200 min comedy + strong close
  ];

  const events: { idx: number; label: string; msgs: string; color: string }[] = [
    { idx: 9,  label: "Hype spike",        msgs: "50",  color: amber },
    { idx: 20, label: "Clutch moment",      msgs: "96",  color: lime  },
    { idx: 26, label: "Chat went quiet",    msgs: "8",   color: rose  },
    { idx: 37, label: "Comedy moment",      msgs: "90",  color: cyan  },
  ];

  const maxH = 64;
  const timeLabels = ["0:00", "45m", "1:30", "2:15", "3:00+"];

  return (
    <div style={{ borderRadius: 16, overflow: "hidden", background: "#0C111C", border: `1px solid ${line}`, padding: "24px 24px 20px", boxShadow: "0 30px 80px -30px rgba(0,0,0,0.7)" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.32em", textTransform: "uppercase", color: ink3, marginBottom: 4 }}>Chat Pulse</div>
          <div style={{ fontFamily: serif, fontSize: 22, color: ink }}>When your audience <em style={{ color: lime, fontStyle: "italic" }}>reacted.</em></div>
        </div>
        <span style={{ fontFamily: mono, fontSize: 10, color: ink3, background: "rgba(255,255,255,0.04)", border: `1px solid ${line}`, borderRadius: 4, padding: "4px 10px" }}>
          3h 20m stream
        </span>
      </div>

      {/* Activity bars */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.24em", textTransform: "uppercase", color: ink3, marginBottom: 10 }}>Chat activity / minute</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: maxH + 12 }}>
          {barData.map((v, i) => {
            const h = Math.max(3, Math.round((v / 100) * maxH));
            const ev = events.find((e) => e.idx === i);
            const barColor = ev ? ev.color : v > 70 ? lime : v > 35 ? amber : ink4;
            const opacity  = ev ? 1 : v > 70 ? 0.85 : v > 35 ? 0.55 : 0.3;
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: maxH + 12, minWidth: 0 }}>
                {ev && (
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: ev.color, boxShadow: `0 0 8px ${ev.color}`, marginBottom: 3, flexShrink: 0 }} />
                )}
                <div style={{ width: "100%", height: h, background: barColor, borderRadius: "2px 2px 0 0", opacity }} />
              </div>
            );
          })}
        </div>
        {/* Time axis */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          {timeLabels.map((t) => (
            <span key={t} style={{ fontFamily: mono, fontSize: 9, color: ink4 }}>{t}</span>
          ))}
        </div>
      </div>

      {/* Event list */}
      <div style={{ borderTop: `1px solid ${line}`, paddingTop: 16, marginTop: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
          {events.map((e) => (
            <div key={e.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, background: "rgba(255,255,255,0.025)", border: `1px solid ${e.color}1A` }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: e.color, flexShrink: 0, boxShadow: `0 0 7px ${e.color}88` }} />
              <div>
                <div style={{ fontFamily: mono, fontSize: 9, color: e.color, letterSpacing: "0.1em" }}>{e.msgs} msg/min</div>
                <div style={{ fontSize: 12, color: ink2, marginTop: 2 }}>{e.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderTop: `1px solid ${line}`, marginTop: 16, paddingTop: 16 }}>
        {([["Chat score", "64/100", amber], ["Peak", "96 msg/min", lime], ["Quiet time", "18 min", rose]] as [string, string, string][]).map(([k, v, c], i, arr) => (
          <div key={k} style={{ paddingLeft: i > 0 ? 16 : 0, paddingRight: i < arr.length - 1 ? 16 : 0, borderRight: i < arr.length - 1 ? `1px solid ${line}` : "none" }}>
            <div style={{ fontFamily: mono, fontSize: 9, color: ink3, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 5 }}>{k}</div>
            <div style={{ fontFamily: serif, fontSize: 20, color: c, lineHeight: 1 }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Full report visual (used in §05) — matches current coach-report-card design ─── */
function ReportVisual() {
  const serif = '"Instrument Serif", Georgia, serif';
  const mono  = '"JetBrains Mono", monospace';
  const ink   = "#ECF1FA";
  const ink2  = "#A6B3C9";
  const ink3  = "#6F7C95";
  const ink4  = "#4D5876";
  const line  = "rgba(255,255,255,0.07)";
  const line2 = "rgba(255,255,255,0.12)";
  const lime  = "#A3E635";
  const amber = "#F59E0B";
  const rose  = "#F87171";
  const cyan  = "#22D3EE";

  // Sub-score color helpers matching last-stream-recap.tsx
  const ssColor  = (v: number) => v >= 66 ? lime  : v >= 33 ? amber  : rose;
  const ssBg     = (v: number) => v >= 66 ? "rgba(163,230,53,0.05)"  : v >= 33 ? "rgba(245,158,11,0.04)"  : "rgba(248,113,113,0.05)";
  const ssBorder = (v: number) => v >= 66 ? "rgba(163,230,53,0.22)"  : v >= 33 ? "rgba(245,158,11,0.20)"  : "rgba(248,113,113,0.22)";

  return (
    <div style={{ borderRadius: 16, overflow: "hidden", background: "#0C111C", border: `1px solid ${line}`, boxShadow: "0 40px 80px -40px rgba(0,0,0,0.6)", color: ink, WebkitFontSmoothing: "antialiased", backgroundImage: "radial-gradient(900px 500px at 80% -100px, rgba(34,211,238,0.06), transparent 60%), radial-gradient(700px 400px at 0% 30%, rgba(163,230,53,0.03), transparent 60%)" }}>
      <div style={{ padding: "32px 28px 48px" }}>

        {/* Masthead */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, paddingBottom: 16, borderBottom: `1px solid ${line}`, marginBottom: 28, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.32em", textTransform: "uppercase", color: ink3, marginBottom: 4 }}>Stream Debrief</div>
            <div style={{ fontFamily: serif, fontSize: 34, lineHeight: 1.05, color: ink }}>Gaming <em style={{ fontStyle: "italic", color: cyan }}>Coaching</em></div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span style={{ padding: "3px 9px", border: `1px solid rgba(34,211,238,0.32)`, borderRadius: 4, background: "rgba(34,211,238,0.06)", color: cyan, fontSize: 11, fontFamily: mono }}>◆ Consistent Creator</span>
            <span style={{ padding: "3px 9px", border: `1px solid rgba(245,158,11,0.32)`, borderRadius: 4, background: "rgba(245,158,11,0.06)", color: amber, fontSize: 11, fontFamily: mono }}>▲ 4-stream streak</span>
          </div>
        </div>

        {/* Hero: dial + story */}
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 40, alignItems: "start", marginBottom: 32 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.32em", textTransform: "uppercase", color: ink3, marginBottom: 14, textAlign: "left" }}>Performance Score</div>
            <StaticDial score={67} size={220} />
            <div style={{ marginTop: 12, fontFamily: serif, fontSize: 17, color: lime, fontStyle: "italic" }}>↗ +8 from last stream</div>
            <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 5, justifyContent: "center" }}>
              {([["Building Energy", lime, "rgba(163,230,53,0.4)"], ["Low Risk", lime, "rgba(163,230,53,0.4)"], ["Strong Open", lime, "rgba(163,230,53,0.4)"], ["Mixed Close", amber, "rgba(245,158,11,0.4)"]] as [string,string,string][]).map(([l, c, b]) => (
                <span key={l} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 999, fontSize: 10, border: `1px solid ${b}`, color: c }}>
                  <span style={{ width: 4, height: 4, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />{l}
                </span>
              ))}
            </div>
          </div>
          <div style={{ paddingTop: 4 }}>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.32em", textTransform: "uppercase", color: ink3, marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 24, height: 1, background: ink4, display: "inline-block" }} />The Story of This Stream
            </div>
            <p style={{ fontFamily: "system-ui, -apple-system, sans-serif", fontSize: 15, lineHeight: 1.65, color: "#D4DCF0", margin: 0 }}>
              Three solid hours on Elden Ring, anchored by a clean Malenia clear at 2:55. You opened hot, dipped at the 1:40 mark when chat went quiet, then recovered for one of your sharpest closing stretches of the week.
            </p>
          </div>
        </div>

        {/* #1 Fix */}
        <div style={{ marginBottom: 28, padding: "20px 22px 22px", borderRadius: 12, background: "linear-gradient(180deg, rgba(248,113,113,0.07), rgba(248,113,113,0.02))", border: "1px solid rgba(248,113,113,0.28)", borderLeft: `3px solid ${rose}` }}>
          <div style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: rose, marginBottom: 12 }}>The #1 Fix</div>
          <p style={{ fontFamily: "system-ui, -apple-system, sans-serif", fontSize: 15, lineHeight: 1.65, color: ink, margin: 0 }}>
            Lead the room when chat goes quiet — your job is to set the tempo, not match it. Narrate every clutch attempt out loud.
          </p>
        </div>

        <div style={{ borderTop: `1px solid ${line}`, margin: "0 0 28px" }} />

        {/* What worked / Fix — InsightCard tile style */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, marginBottom: 36, position: "relative" }}>
          <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: line, transform: "translateX(-50%)" }} />
          <div>
            <div style={{ fontFamily: serif, fontSize: 26, marginBottom: 4, color: ink }}>What <em style={{ fontStyle: "italic", color: lime }}>worked.</em></div>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", color: ink3, marginBottom: 16 }}>Keep doing these</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {([["Clutch Read", "Mechanical breakdown of the stun trap interaction at 2:11 — exactly what viewers want to learn.", "2:11"], ["Energy Open", "First 10 minutes were full-presence and set the tone for the whole session.", "0:08"]] as [string,string,string][]).map(([l, b, t], i) => (
                <div key={l} style={{ position: "relative", padding: "12px 14px 14px 18px", borderRadius: 8, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderLeft: `3px solid ${lime}` }}>
                  <span style={{ position: "absolute", top: 10, right: 12, fontFamily: mono, fontSize: 10, color: lime, opacity: 0.85 }}>{t}</span>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6, paddingRight: 48 }}>
                    <span style={{ fontFamily: mono, fontSize: 9, color: ink4, fontWeight: 700, letterSpacing: "0.16em" }}>0{i + 1}</span>
                    <span style={{ fontWeight: 600, fontSize: 13, color: lime, lineHeight: 1.35 }}>{l}</span>
                  </div>
                  <p style={{ fontSize: 13, color: ink2, lineHeight: 1.6, margin: 0, paddingLeft: 22 }}>{b}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontFamily: serif, fontSize: 26, marginBottom: 4, color: ink }}>What to <em style={{ fontStyle: "italic", color: amber }}>fix.</em></div>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", color: ink3, marginBottom: 16 }}>Change these next time</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {([["Silent Grind", "84% of the stream was silent during active match — chat had nothing to react to.", "1:42"], ["No Take", "Recognized opponents but never gave a strong opinion — give viewers something to agree or argue with.", "2:25"]] as [string,string,string][]).map(([l, b, t], i) => (
                <div key={l} style={{ position: "relative", padding: "12px 14px 14px 18px", borderRadius: 8, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderLeft: `3px solid ${amber}` }}>
                  <span style={{ position: "absolute", top: 10, right: 12, fontFamily: mono, fontSize: 10, color: amber, opacity: 0.85 }}>{t}</span>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6, paddingRight: 48 }}>
                    <span style={{ fontFamily: mono, fontSize: 9, color: ink4, fontWeight: 700, letterSpacing: "0.16em" }}>0{i + 1}</span>
                    <span style={{ fontWeight: 600, fontSize: 13, color: amber, lineHeight: 1.35 }}>{l}</span>
                  </div>
                  <p style={{ fontSize: 13, color: ink2, lineHeight: 1.6, margin: 0, paddingLeft: 22 }}>{b}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sub-scores — individual tinted cards (matches last-stream-recap style) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, margin: "0 0 28px" }}>
          {([["energy", 74], ["engagement", 61], ["consistency", 70], ["content", 63]] as [string, number][]).map(([k, v]) => (
            <div key={k} style={{ padding: "12px 14px", borderRadius: 8, background: ssBg(v), border: `1px solid ${ssBorder(v)}`, borderLeft: `3px solid ${ssColor(v)}` }}>
              <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: ssColor(v), marginBottom: 6 }}>{k}</div>
              <div style={{ fontFamily: serif, fontSize: 32, lineHeight: 1, letterSpacing: "-0.03em", color: ssColor(v) }}>
                {v}<span style={{ fontFamily: mono, fontSize: 9, color: ink4, letterSpacing: "0.08em" }}>/100</span>
              </div>
              <div style={{ height: 3, borderRadius: 3, background: "rgba(255,255,255,0.06)", marginTop: 8, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${v}%`, background: ssColor(v), borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </div>

        {/* Opening / Closing — ArcCard style (whole box tinted by quality) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, margin: "0 0 28px" }}>
          {([
            { index: "i", label: "Opening", quality: "strong" as "strong" | "average" | "weak", body: "Came in with energy and a clear hook within the first 90 seconds. Strong start — energy held through the early grind." },
            { index: "ii", label: "Closing", quality: "average" as "strong" | "average" | "weak", body: "Finished stronger than the mid-stream dip but the sign-off came before the final tactic breakdown — front-load next time." },
          ]).map(({ index, label, quality, body }) => {
            const qColor = quality === "strong" ? lime : quality === "weak" ? rose : amber;
            const qBg    = quality === "strong" ? "rgba(163,230,53,0.05)" : quality === "weak" ? "rgba(248,113,113,0.06)" : "rgba(245,158,11,0.05)";
            return (
              <div key={label} style={{ padding: "16px 18px 18px", borderRadius: 10, background: qBg, border: `1px solid ${qColor}55`, borderLeft: `3px solid ${qColor}` }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
                  <span style={{ fontFamily: serif, fontStyle: "italic", fontSize: 20, color: qColor, lineHeight: 1, letterSpacing: "-0.02em" }}>{index}.</span>
                  <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: qColor }}>{label}</span>
                </div>
                <p style={{ fontFamily: "system-ui, -apple-system, sans-serif", fontSize: 14, color: ink, lineHeight: 1.55, margin: 0 }}>{body}</p>
              </div>
            );
          })}
        </div>

        {/* Best Moment */}
        <div style={{ margin: "0 0 28px", padding: "16px 18px", borderRadius: 8, background: "rgba(163,230,53,0.05)", border: "1px solid rgba(163,230,53,0.2)", borderLeft: `3px solid ${lime}` }}>
          <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: lime, marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
            Best Moment
            <span style={{ color: ink3, marginLeft: "auto", fontSize: 11, textTransform: "none", letterSpacing: "0.06em" }}>2:55:31</span>
          </div>
          <p style={{ fontFamily: "system-ui, -apple-system, sans-serif", fontSize: 14, color: ink, lineHeight: 1.55, margin: 0 }}>
            The Malenia phase 2 clear — clean execution, voice never cracked, and the reaction at the end was completely unscripted. That&apos;s the clip of the night.
          </p>
        </div>

        {/* Missions */}
        <div style={{ paddingTop: 22, borderTop: `1px solid ${line}`, borderBottom: `1px solid ${line}`, paddingBottom: 12, marginBottom: 28 }}>
          <div style={{ fontFamily: serif, fontSize: 28, marginBottom: 4, color: ink }}>Missions for <em style={{ fontStyle: "italic", color: cyan }}>next stream.</em></div>
          <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", color: ink3, marginBottom: 20 }}>Click to mark as committed</div>
          {(["Narrate every clutch attempt out loud — set the tempo, don't match it.", "Open with one specific take per match — who they remind you of, what makes them dangerous.", "Front-load your tactical breakdowns — best content shouldn't arrive at the sign-off."] as string[]).map((g, i, arr) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "44px 1fr 28px", gap: 12, alignItems: "start", padding: "13px 0", borderBottom: i < arr.length - 1 ? `1px dashed ${line2}` : "none" }}>
              <span style={{ fontFamily: serif, fontStyle: "italic", fontSize: 28, color: cyan, letterSpacing: "-0.03em", lineHeight: 0.9 }}>{["i.", "ii.", "iii."][i]}</span>
              <p style={{ fontFamily: "system-ui, -apple-system, sans-serif", fontSize: 14, lineHeight: 1.6, color: ink, margin: 0 }}>{g}</p>
              <div style={{ width: 20, height: 20, border: `1.5px solid ${ink4}`, borderRadius: 4, marginTop: 2 }} />
            </div>
          ))}
        </div>

        {/* Signoff */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24 }}>
          <div>
            <p style={{ fontFamily: serif, fontStyle: "italic", fontSize: 17, color: ink2, lineHeight: 1.5, margin: 0 }}>
              Go live.<br />Own your stream.<br /><strong style={{ color: ink, fontWeight: 400 }}>Level up.</strong>
            </p>
            <p style={{ fontFamily: serif, fontStyle: "italic", fontSize: 28, color: ink2, letterSpacing: "-0.02em", transform: "rotate(-2deg) translateX(-4px)", lineHeight: 1, marginTop: 12, display: "inline-block" }}>— LevlCast</p>
          </div>
          <div style={{ textAlign: "right", fontFamily: mono, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: ink4, lineHeight: 1.8 }}>Coach Report<br />Stream Debrief</div>
        </div>

      </div>
    </div>
  );
}

/* ─── Data ─── */

const steps = [
  { n: "01", cls: "blue",  title: "Stream normally",   body: "Nothing changes about how you go live. No setup, no overlay, no extra software to run.",                                   Icon: TwitchIcon },
  { n: "02", cls: "green", title: "Hit Sync after",    body: "Open LevlCast after you end stream and hit Sync. Your VOD shows up. One button to start the analysis.",                    Icon: SyncIcon },
  { n: "03", cls: "cyan",  title: "Read your report",  body: "You get a 0–100 score with exact timestamps — what worked, what didn't, and the one thing to fix next time.",              Icon: DocIcon },
  { n: "04", cls: "mint",  title: "Go live again",     body: "Take the one thing from the report into your next stream. Analyze it after. That's the whole loop.",                       Icon: TrendIcon },
];

const features = [
  { cls: "blue",  Icon: CoachIcon, title: "Know Why Viewers Leave", body: "See the exact moments viewers tuned out — dead air, slow openings, the parts your chat went quiet. One specific fix every session, not a list of generic tips." },
  { cls: "green", Icon: ClipIcon,  title: "Auto Clips",             body: "LevlCast finds your best hype, comedy, and clutch moments. One tap cuts and captions the clip — no timeline scrubbing, no editing software." },
  { cls: "cyan",  Icon: PlayIcon,  title: "Post to YouTube",        body: "Connect your channel once and post clips to Shorts from inside the app. The title fills itself from the report. Takes about 30 seconds." },
];

const faqItems = [
  { q: "How long does analysis take?", a: "Usually 2–5 minutes. Longer streams take a bit more — it scales roughly with stream length. You get a push notification the moment the report is ready." },
  { q: "Do you store my VODs?", a: "No. We pull the audio from Twitch while we're analyzing it, then throw it away. The only things we keep are the report output and any clips you explicitly generate." },
  { q: "What about YouTube?", a: "Connect your channel once. After that you can post clips straight to Shorts from inside LevlCast — the title and description come from the report. Edit them if you want, or just tap post." },
  { q: "Is it actually free?", a: "Yeah. One full VOD analysis and 5 clips per month, permanently. No trial period, no credit card, no expiry. If you want more than that, that's what Pro is for." },
  { q: "Does it work for my channel?", a: "Any public Twitch channel works — partner, affiliate, or 3 viewers. Sign in with Twitch, hit Sync after a stream, and that's the whole setup." },
];

/* ─── Page ─── */

export default function LandingPage() {
  return (
    <div className="landing-v2">
      {/* Fonts for coach report mocks */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      {/* Urgency bar */}
      <div className="urgency-bar">
        <span className="pulse"></span>
        Founding member pricing locks in <b>$9.99/mo for life</b> · increases to $14.99 soon
      </div>

      <NavBarLanding />

      {/* ─── HERO ─── */}
      <section className="hero">
        <div className="hero-bg" aria-hidden="true"></div>
        <div className="container">
          <div className="hero-grid">
              {/* Text block */}
              <div style={{ maxWidth: 640 }}>
                <h1 style={{ marginTop: 0 }}>
                  Stop guessing what&apos;s<br/>
                  wrong with your <span className="accent-2">stream.</span>
                </h1>
                <p className="hero-sub" style={{ marginTop: 28 }}>
                  LevlCast reads your VOD after every stream and tells you the exact moments that lost viewers —
                  dead air, slow openings, the parts your chat went quiet.
                  Not generic advice. Timestamps.
                </p>
                <div className="hero-cta-row">
                  <Link href="/auth/login" className="btn btn-primary">
                    Get Your First Report Free <ArrowIcon/>
                  </Link>
                  <a href="#how-it-works" className="btn btn-ghost">How it works</a>
                </div>
                <div className="hero-foot">Free to start · No credit card · We cannot log in to your Twitch</div>
                <div className="hero-stats">
                  <div className="hero-stat">
                    <div className="v blue">0–100</div>
                    <div className="k">Score every stream</div>
                  </div>
                  <div className="hero-stat">
                    <div className="v green">~5 min</div>
                    <div className="k">Average analysis time</div>
                  </div>
                  <div className="hero-stat">
                    <div className="v">1 fix</div>
                    <div className="k">Per session, specific</div>
                  </div>
                </div>
              </div>

              {/* Full-width video */}
              <div style={{ width: "100%", borderRadius: 16, boxShadow: "0 0 0 1px rgba(255,255,255,0.1), 0 40px 100px -20px rgba(0,0,0,0.9)", background: "#000", lineHeight: 0, overflow: "hidden" }}>
                <video
                  autoPlay
                  muted
                  loop
                  playsInline
                  style={{ width: "100%", display: "block" }}
                >
                  <source src="/demo/LEVLCASTHEROAGAIN.mp4" type="video/mp4" />
                  <source src="/demo/Levlcastherovideo.mov" type="video/quicktime" />
                </video>
              </div>
          </div>
        </div>
      </section>

      {/* ─── App Store Trust Strip ─── */}
      <div className="container" style={{ padding: "20px 0 64px" }}>
        <div className="appstore-card">
          <div className="asc-left">
            <div className="asc-eyebrow mono">Built for iPhone</div>
            <div className="asc-headline">Your coach,<br/>in your pocket.</div>
            <div className="asc-sub">Reports land on your phone the moment your stream ends. Read them on the couch, between matches, or before you go live again — wherever the next session starts.</div>
            <div className="asc-actions">
              <a className="appstore-btn-big" href="https://apps.apple.com/us/app/levlcast/id6761281566" target="_blank" rel="noopener noreferrer">
                <AppleIcon/>
                <div>
                  <small>Download on the</small>
                  <b>App Store</b>
                </div>
              </a>
              <div className="asc-meta">
                <div className="asc-meta-item">
                  <div className="v">Free</div>
                  <div className="k">First report</div>
                </div>
                <div className="asc-meta-item">
                  <div className="v">iOS 16+</div>
                  <div className="k">iPhone &amp; iPad</div>
                </div>
              </div>
            </div>
          </div>
          <div className="asc-right">
            <div className="asc-phone">
              <div className="asc-notch"></div>
              <div className="asc-screen">
                <div className="asc-time mono">9:41</div>
                <div className="asc-notif">
                  <div className="asc-notif-row">
                    <div className="asc-app-icon"><span className="logo-mark" style={{ width: 18, height: 18 }}></span></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--ink-2)" }}>LevlCast</span>
                        <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>now</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4, color: "var(--ink)" }}>Your stream score is up.</div>
                      <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 2, lineHeight: 1.35 }}>67/100 · +8 from last stream. Tap to see what worked.</div>
                    </div>
                  </div>
                </div>
                <div className="asc-notif asc-notif-2">
                  <div className="asc-notif-row">
                    <div className="asc-app-icon"><span className="logo-mark" style={{ width: 18, height: 18 }}></span></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--ink-2)" }}>LevlCast</span>
                        <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>2h</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4, color: "var(--ink)" }}>5 clips ready to post.</div>
                      <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 2, lineHeight: 1.35 }}>Auto-edited and captioned. Send to YouTube?</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── PROBLEM ─── */}
      <section className="section" id="problem">
        <div className="container">
          <div className="sec-head">
            <h2>Most streamers are flying<br/><span style={{ color: "var(--blue)" }}>completely blind.</span></h2>
            <p className="lead" style={{ marginTop: 18 }}>
              You end stream, check your viewer count, see the same number, and have no idea what to change.
              Nobody watches back your VODs and gives you honest notes. So you do the same thing next stream.
            </p>
          </div>

          <div className="problem-grid">
            <div className="problem-card blue">
              <span className="topline"></span>
              <h3>You&apos;re too in it to see what&apos;s wrong</h3>
              <p>You&apos;re focused on the game, the chat, the everything. The 3-minute silence at 1:40 — you didn&apos;t notice it. Your viewers did.</p>
            </div>

            <div className="problem-card green tall">
              <div>
                <span className="topline"></span>
                <h3>No one&apos;s telling you the truth</h3>
                <p>Your friends say it was great. Your mods don&apos;t want to be harsh. Nobody actually tells you the 18 minutes of dead air at 1:40 is why viewers left.</p>
              </div>
              <div className="footer-meta">
                <span className="k">Average dead air per stream</span>
                <span className="v">18 minutes</span>
              </div>
            </div>

            <div className="problem-card cyan">
              <span className="topline"></span>
              <h3>Last stream&apos;s best moment is already gone</h3>
              <p>Something good happened at 2:30. Nobody clipped it. The VOD expires in 14 days and that&apos;s it. Happens every stream.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="section" id="how-it-works">
        <div className="container">
          <div className="sec-head">
            <h2 style={{ marginTop: 0 }}>Four steps.<br/>No new habits to build.</h2>
          </div>

          <div className="steps">
            {steps.map((s) => {
              const StepIcon = s.Icon;
              return (
                <div className={`step ${s.cls}`} key={s.n}>
                  <span className="topline"></span>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span className="step-num mono">{s.n}</span>
                      <span className="step-icon"><StepIcon/></span>
                    </div>
                    <h3 style={{ marginTop: 22 }}>{s.title}</h3>
                    <p>{s.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section className="section" id="features">
        <div className="container">
          <div className="sec-head">
            <h2 style={{ marginTop: 0 }}>What you actually get.</h2>
            <p className="lead" style={{ marginTop: 18 }}>Three things, built around the VOD workflow. Nothing else.</p>
          </div>
          <div className="features">
            {features.map((f, i) => {
              const FIcon = f.Icon;
              return (
                <div className={`feature ${f.cls}`} key={i}>
                  <span className="topline"></span>
                  <div className="ico"><FIcon/></div>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── CHAT PULSE ─── */}
      <section className="section" id="chat-pulse">
        <div className="container">
          <div className="sec-head">
            <h2 style={{ marginTop: 0 }}>Your chat is telling you<br/><span style={{ color: "var(--green)" }}>what worked.</span></h2>
            <p className="lead" style={{ marginTop: 18 }}>
              We link your chat volume to every moment of your stream.
              The spike at 1:55 confirms your best clip. The drop at 2:20 tells you what to fix.
              Not a heatmap — exact timestamps you can act on.
            </p>
          </div>

          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            <ChatPulseMock />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, marginTop: 40 }}>
            {([
              ["Match clips to spikes", "Chat volume confirms your best moments — every AI-detected clip is backed by real audience reaction data."],
              ["Find the drop-offs", "See exactly where chat went quiet so you know what to change. Not a guess — a timestamp."],
              ["Correlated with your voice", "Chat spikes are mapped to your transcript. Know what you said that made people react."],
            ] as [string, string][]).map(([t, b]) => (
              <div key={t} style={{ padding: "18px 20px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>{t}</div>
                <p style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.6, margin: 0 }}>{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── COACHING REPORT ─── */}
      <section className="section" id="report">
        <div className="container">
          <div className="sec-head">
            <h2 style={{ marginTop: 0 }}>This is what you get<br/>after every stream.</h2>
            <p className="lead" style={{ marginTop: 18 }}>
              A scored breakdown of what actually happened — not &ldquo;be more engaging.&rdquo;
              Specific timestamps, what worked, what to fix, and three goals to carry into next session.
            </p>
          </div>

          <ReportVisual/>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section className="section" id="pricing">
        <div className="container" style={{ textAlign: "center" }}>
          <h2 style={{ marginTop: 0 }}>Two plans. No tricks.</h2>
          <p className="lead" style={{ margin: "18px auto 56px" }}>Start free. Every feature is real — no paywalled demo mode.</p>

          <div className="pricing">
            <div className="plan">
              <h3>Free</h3>
              <div className="plan-tag">Good enough to know if it&apos;s for you.</div>
              <div className="plan-price">
                <span className="amt">$0</span>
                <span className="per">/forever</span>
              </div>
              <ul>
                <li><CheckIcon color="var(--green)"/>1 full VOD analysis per month</li>
                <li><CheckIcon color="var(--green)"/>Full coaching report + score</li>
                <li><CheckIcon color="var(--green)"/>5 clips per month</li>
                <li><CheckIcon color="var(--green)"/>iOS app + web</li>
              </ul>
              <Link href="/auth/login" className="btn btn-ghost">Get started free</Link>
            </div>

            <div className="plan featured">
              <span className="plan-badge">Founding Price — locks in for life</span>
              <h3>Pro</h3>
              <div className="plan-tag">For streamers who analyze every session.</div>
              <div className="plan-price">
                <span className="amt">$9.99</span>
                <span className="per">/month</span>
              </div>
              <div className="plan-price-note">Price goes to $14.99 soon. Founders keep $9.99.</div>
              <ul>
                <li><CheckIcon color="var(--blue)"/>20 VOD analyses per month</li>
                <li><CheckIcon color="var(--blue)"/>20 clips per month</li>
                <li><CheckIcon color="var(--blue)"/>Post to YouTube Shorts</li>
                <li><CheckIcon color="var(--blue)"/>Priority processing</li>
                <li><CheckIcon color="var(--blue)"/>Everything in Free</li>
              </ul>
              <Link href="/auth/login" className="btn btn-primary">Get Pro — $9.99/mo</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="section" id="faq">
        <div className="container">
          <div className="sec-head" style={{ maxWidth: 600, marginBottom: 48 }}>
            <h2 style={{ marginTop: 0 }}>Common questions.</h2>
          </div>

          <FaqAccordion items={faqItems} />
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section style={{ padding: "40px 0 0" }}>
        <div className="container">
          <div className="cta-strip">
            <div>
              <h2>Your VOD is sitting there right now.</h2>
              <p className="lead">Connect Twitch, hit Sync, and read your first report in under 10 minutes. Free.</p>
            </div>
            <Link href="/auth/login" className="btn btn-primary">Get Your First Report Free <ArrowIcon/></Link>
          </div>
        </div>
      </section>

      <FooterLanding />
    </div>
  );
}
