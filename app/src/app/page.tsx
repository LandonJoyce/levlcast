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

/* ─── Full report visual (used in §04) — editorial style matching new coach-report-card ─── */
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

  return (
    <div style={{ borderRadius: 16, overflow: "hidden", background: "#0C111C", border: `1px solid ${line}`, boxShadow: "0 40px 80px -40px rgba(0,0,0,0.6)", color: ink, WebkitFontSmoothing: "antialiased", backgroundImage: "radial-gradient(900px 500px at 80% -100px, rgba(34,211,238,0.06), transparent 60%)" }}>
      <div style={{ padding: "28px 24px 40px" }}>

        {/* Masthead */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, paddingBottom: 14, borderBottom: `1px solid ${line}`, marginBottom: 24, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.32em", textTransform: "uppercase", color: ink3, marginBottom: 3 }}>Stream Debrief</div>
            <div style={{ fontFamily: serif, fontSize: 28, lineHeight: 1, color: ink }}>Gaming <em style={{ fontStyle: "italic", color: cyan }}>Coaching</em></div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span style={{ padding: "3px 8px", border: `1px solid rgba(34,211,238,0.32)`, borderRadius: 4, background: "rgba(34,211,238,0.06)", color: cyan, fontSize: 10, fontFamily: mono }}>◆ Consistent Creator</span>
            <span style={{ padding: "3px 8px", border: `1px solid rgba(245,158,11,0.32)`, borderRadius: 4, background: "rgba(245,158,11,0.06)", color: amber, fontSize: 10, fontFamily: mono }}>▲ 4-stream streak</span>
          </div>
        </div>

        {/* Hero: dial + story */}
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 32, alignItems: "start", marginBottom: 28 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.28em", textTransform: "uppercase", color: ink3, marginBottom: 10, textAlign: "left" }}>Performance Score</div>
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
            <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.28em", textTransform: "uppercase", color: ink3, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 20, height: 1, background: ink4, display: "inline-block" }} />The Story of This Stream
            </div>
            <p style={{ fontFamily: serif, fontSize: 18, lineHeight: 1.45, color: ink, margin: "0 0 20px" }}>
              Three solid hours on Elden Ring, anchored by a clean Malenia clear at 2:55. You opened hot, dipped at the 1:40 mark when chat went quiet, then recovered for one of your sharpest closing stretches of the week.
            </p>
          </div>
        </div>

        {/* Opening row */}
        <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 20, padding: "16px 0", borderBottom: `1px dashed ${line2}` }}>
          <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.28em", textTransform: "uppercase", color: ink3 }}>
            <span style={{ fontFamily: serif, color: cyan, fontSize: 22, fontStyle: "italic", display: "block", marginBottom: 2, lineHeight: 1 }}>i.</span>Opening
          </div>
          <p style={{ fontFamily: serif, fontSize: 16, lineHeight: 1.5, color: ink, margin: 0 }}>Came in with energy and a clear hook within the first 90 seconds. Strong start — energy held through the early grind.</p>
        </div>

        {/* #1 Fix row */}
        <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 20, padding: "16px 20px 16px 16px", margin: "0 -16px", borderBottom: `1px dashed ${line2}`, borderLeft: `2px solid ${rose}`, background: "linear-gradient(180deg, rgba(248,113,113,0.04), transparent 80%)" }}>
          <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.28em", textTransform: "uppercase", color: rose }}>
            <span style={{ fontFamily: serif, color: rose, fontSize: 22, fontStyle: "italic", display: "block", marginBottom: 2, lineHeight: 1 }}>ii.</span>The #1 Fix
          </div>
          <p style={{ fontFamily: serif, fontSize: 16, lineHeight: 1.5, color: ink, margin: 0 }}>
            Lead the room when chat goes quiet — your job is to set the tempo, not match it. Narrate every clutch attempt out loud.
          </p>
        </div>

        {/* Sub-scores */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", margin: "28px 0 24px", borderTop: `1px solid ${line}`, borderBottom: `1px solid ${line}`, padding: "16px 0" }}>
          {([["energy", 74, lime], ["engagement", 61, amber], ["consistency", 70, lime], ["content", 63, amber]] as [string, number, string][]).map(([k, v, c], i, arr) => (
            <div key={k} style={{ padding: i === 0 ? "0 16px 0 0" : i === arr.length - 1 ? "0 0 0 16px" : "0 16px", borderRight: i < arr.length - 1 ? `1px solid ${line}` : "none" }}>
              <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.24em", textTransform: "uppercase", color: ink3, marginBottom: 6 }}>{k}</div>
              <div style={{ fontFamily: serif, fontSize: 38, lineHeight: 0.9, letterSpacing: "-0.04em", marginBottom: 7, color: c }}>
                {v}<span style={{ fontFamily: mono, fontSize: 10, color: ink4, letterSpacing: "0.1em" }}>/100</span>
              </div>
              <div style={{ height: 4, borderRadius: 3, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${v}%`, background: c, borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </div>

        {/* Best Moment */}
        <div style={{ margin: "0 0 24px", padding: "18px 0 18px 24px", position: "relative", borderLeft: `2px solid ${lime}` }}>
          <div style={{ position: "absolute", left: 12, top: 2, fontFamily: serif, fontSize: 64, lineHeight: 1, color: lime, opacity: 0.35, fontStyle: "italic", userSelect: "none" }}>"</div>
          <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.28em", textTransform: "uppercase", color: lime, marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
            Best Moment <span style={{ color: ink3, marginLeft: "auto", fontSize: 11, textTransform: "none", letterSpacing: "0.06em" }}>2:55:31</span>
          </div>
          <p style={{ fontFamily: serif, fontSize: 16, lineHeight: 1.5, color: ink, margin: 0 }}>
            The Malenia phase 2 clear — clean execution, voice never cracked, and the reaction at the end was completely unscripted. That&apos;s the clip of the night.
          </p>
        </div>

        {/* What worked / Fix */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 36, marginBottom: 28, position: "relative" }}>
          <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: line, transform: "translateX(-50%)" }} />
          <div>
            <div style={{ fontFamily: serif, fontSize: 22, marginBottom: 4, color: ink }}>What <em style={{ fontStyle: "italic", color: lime }}>worked.</em></div>
            <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.24em", textTransform: "uppercase", color: ink3, marginBottom: 16 }}>Keep doing these</div>
            {[["01", "Clutch Read", "Mechanical breakdown of the stun trap interaction at 2:11 — exactly what viewers want to learn.", "2:11"], ["02", "Energy Open", "First 10 minutes were full-presence and set the tone for the whole session.", "0:08"]].map(([n, l, b, t]) => (
              <div key={n} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: serif, fontStyle: "italic", fontSize: 14, color: ink4 }}>{n}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: lime, flex: 1 }}>{l}</span>
                  <span style={{ fontFamily: mono, fontSize: 10, color: ink3 }}>{t}</span>
                </div>
                <p style={{ fontSize: 13, color: ink2, lineHeight: 1.6, paddingLeft: 28, margin: 0 }}>{b}</p>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontFamily: serif, fontSize: 22, marginBottom: 4, color: ink }}>What to <em style={{ fontStyle: "italic", color: amber }}>fix.</em></div>
            <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.24em", textTransform: "uppercase", color: ink3, marginBottom: 16 }}>Change these next time</div>
            {[["01", "Silent Grind", "84% of the stream was silent during active match — chat had nothing to react to.", "1:42"], ["02", "No Take", "Recognized opponents but never gave a strong opinion — give viewers something to agree or argue with.", "2:25"]].map(([n, l, b, t]) => (
              <div key={n} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: serif, fontStyle: "italic", fontSize: 14, color: ink4 }}>{n}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: amber, flex: 1 }}>{l}</span>
                  <span style={{ fontFamily: mono, fontSize: 10, color: ink3 }}>{t}</span>
                </div>
                <p style={{ fontSize: 13, color: ink2, lineHeight: 1.6, paddingLeft: 28, margin: 0 }}>{b}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Missions */}
        <div style={{ paddingTop: 20, borderTop: `1px solid ${line}` }}>
          <div style={{ fontFamily: serif, fontSize: 22, marginBottom: 4, color: ink }}>Missions for <em style={{ fontStyle: "italic", color: cyan }}>next stream.</em></div>
          <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.24em", textTransform: "uppercase", color: ink3, marginBottom: 16 }}>Click to mark as committed</div>
          {(["Narrate every clutch attempt out loud — set the tempo, don't match it.", "Open with one specific take per match — who they remind you of, what makes them dangerous.", "Front-load your tactical breakdowns — best content shouldn't arrive at the sign-off."] as string[]).map((g, i, arr) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "40px 1fr 24px", gap: 10, alignItems: "start", padding: "11px 0", borderBottom: i < arr.length - 1 ? `1px dashed ${line2}` : "none" }}>
              <span style={{ fontFamily: serif, fontStyle: "italic", fontSize: 26, color: cyan, letterSpacing: "-0.03em", lineHeight: 0.9 }}>{["i.", "ii.", "iii."][i]}</span>
              <p style={{ fontFamily: serif, fontSize: 15, lineHeight: 1.45, color: ink, margin: 0 }}>{g}</p>
              <div style={{ width: 20, height: 20, border: `1.5px solid ${ink4}`, borderRadius: 4, marginTop: 2 }} />
            </div>
          ))}
        </div>

        {/* Signoff */}
        <div style={{ marginTop: 32, paddingTop: 18, borderTop: `1px solid ${line}`, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontFamily: serif, fontStyle: "italic", fontSize: 15, color: ink2, lineHeight: 1.5, margin: 0 }}>Read once.<br />Stream once.<br /><strong style={{ color: ink, fontWeight: 400 }}>See you next time.</strong></p>
            <p style={{ fontFamily: serif, fontStyle: "italic", fontSize: 24, color: ink2, letterSpacing: "-0.02em", transform: "rotate(-2deg) translateX(-3px)", lineHeight: 1, marginTop: 10, display: "inline-block" }}>— LevlCast</p>
          </div>
          <div style={{ textAlign: "right", fontFamily: mono, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: ink4, lineHeight: 1.8 }}>Coach Report<br />Stream Debrief</div>
        </div>

      </div>
    </div>
  );
}

/* ─── Data ─── */

const steps = [
  { n: "01", cls: "blue",  title: "Stream on Twitch",    body: "Just go live like normal. No setup, no overlays, no changes to how you stream.",                                          Icon: TwitchIcon },
  { n: "02", cls: "green", title: "Sync Your VOD",       body: "After your stream, open LevlCast and hit Sync. Your VOD appears instantly — one tap to analyze.",                          Icon: SyncIcon },
  { n: "03", cls: "cyan",  title: "Review Your Report",  body: "Your coach scores the stream 0–100. You get exact timestamps, what worked, what didn't, and one priority to fix.",        Icon: DocIcon },
  { n: "04", cls: "mint",  title: "Improve Next Stream", body: "Take your one goal into your next session. Analyze again. Watch your score climb over time.",                              Icon: TrendIcon },
];

const features = [
  { cls: "blue",  Icon: CoachIcon, title: "Stream Coaching", body: "After every stream, get a scored report with what worked, what didn't, and one specific goal for next time. Feedback on your actual VOD — not generic tips." },
  { cls: "green", Icon: ClipIcon,  title: "Smart Clips",     body: "AI detects your best hype, comedy, clutch, and educational moments. One tap generates a ready-to-post clip — no editing needed." },
  { cls: "cyan",  Icon: PlayIcon,  title: "YouTube Shorts",  body: "Post clips directly to YouTube Shorts from the app. Your best content, live on your channel without leaving LevlCast." },
];

const ranks = [
  { cls: "r1",     range: "0–39",   name: "Fresh Streamer" },
  { cls: "r2",     range: "40–54",  name: "Rising Talent" },
  { cls: "r3 you", range: "55–69",  name: "Consistent Creator" },
  { cls: "r4",     range: "70–79",  name: "Crowd Favorite" },
  { cls: "r5",     range: "80–89",  name: "Elite Entertainer" },
];

const faqItems = [
  { q: "How long does analysis take?", a: "Most VODs analyze in 2–5 minutes after you hit Sync. Longer streams scale roughly linearly. You'll get a notification the moment your report is ready." },
  { q: "Do you store my VODs?", a: "No. We stream your VOD directly from Twitch, analyze it, then discard the raw video. Only your transcription data and any clips you generate stay in your account." },
  { q: "What about YouTube integration?", a: "Connect your YouTube channel once and post Smart Clips straight to Shorts from inside LevlCast. Title and description are pre-filled — you can edit before posting." },
  { q: "Is it really free to start?", a: "Yes. The Free plan is permanent. One full VOD analysis per month and 5 clips total, with the same coaching engine Pro uses. No credit card required." },
  { q: "Does it work with any Twitch streamer?", a: "Yes. Any Twitch channel works — partner, affiliate, or just starting out. Sign in with Twitch, hit Sync after a stream, and that's the whole setup." },
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
            <div>
              <div className="founders-tag">
                <div className="ft-counter">
                  <span className="ft-num">$9.99</span>
                  <span className="ft-spots">per month</span>
                </div>
                <div className="ft-text">
                  <div className="ft-label">Founding Member pricing</div>
                  <div className="ft-sub">Locked in for life · No card</div>
                </div>
                <div className="ft-bar"><span style={{ width: "100%" }}></span></div>
              </div>
              <h1 style={{ marginTop: 26 }}>
                Your Personal<br/>
                <span className="accent">Stream</span> <span className="accent-2">Manager.</span>
              </h1>
              <p className="hero-sub">
                LevlCast watches your VODs and tells you — specifically — what to fix.
                The dead air, the slow openings, the habits you can&apos;t see while you&apos;re live.
                Real coaching on your actual stream, so every session makes you sharper.
              </p>
              <div className="hero-cta-row">
                <Link href="/auth/login" className="btn btn-primary">
                  Get Your First Report Free <ArrowIcon/>
                </Link>
                <a href="#how-it-works" className="btn btn-ghost">How it works</a>
              </div>
              <div className="hero-foot">— Free to start · No credit card required · Cancel anytime</div>

              <div className="hero-stats">
                <div className="hero-stat">
                  <div className="v blue">0–100</div>
                  <div className="k">Score every stream</div>
                </div>
                <div className="hero-stat">
                  <div className="v green">~5 min</div>
                  <div className="k">Average analysis</div>
                </div>
                <div className="hero-stat">
                  <div className="v">1 goal</div>
                  <div className="k">Per session, focused</div>
                </div>
              </div>
            </div>
            <div style={{ borderRadius: 16, boxShadow: "0 0 0 1px rgba(255,255,255,0.1), 0 30px 80px -20px rgba(0,0,0,0.8)", background: "#000", lineHeight: 0, overflow: "hidden", width: "100%" }}>
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

      {/* ─── §01 PROBLEM ─── */}
      <section className="section" id="problem">
        <div className="container">
          <div className="sec-head">
            <div className="sec-marker">
              <span className="num">§ 01</span>
              <span className="rule"/>
              <span className="tag">The Problem</span>
            </div>
            <h2>You don&apos;t have a team.<br/><span style={{ color: "var(--blue)" }}>Now you do.</span></h2>
            <p className="lead" style={{ marginTop: 18 }}>
              Big streamers have managers, coaches, and editors. You&apos;re doing everything yourself.
              LevlCast gives you the same support system — built around your actual VODs.
            </p>
          </div>

          <div className="problem-grid">
            <div className="problem-card blue">
              <span className="topline"></span>
              <span className="num mono">01 / Growth</span>
              <h3>No one managing your growth</h3>
              <p>You stream, you end, you guess. No one is tracking which content works, when you&apos;re burning out, or who you should collab with.</p>
            </div>

            <div className="problem-card green tall">
              <div>
                <span className="topline"></span>
                <span className="num mono">02 / Feedback</span>
                <h3>You don&apos;t know why it&apos;s not growing</h3>
                <p>The habits holding you back — dead air, weak openings, ignored chat — are invisible to you in the moment. No one watches back your VODs and tells you the truth.</p>
              </div>
              <div className="footer-meta">
                <span className="k">Most common gap</span>
                <span className="v">Mid-stream energy dropoff</span>
              </div>
            </div>

            <div className="problem-card cyan">
              <span className="topline"></span>
              <span className="num mono">03 / Clips</span>
              <h3>Your best moments go unclipped</h3>
              <p>You had 5 great moments last stream. But you didn&apos;t clip them, so they disappeared when the VOD expired in two weeks.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── §02 HOW IT WORKS ─── */}
      <section className="section" id="how-it-works">
        <div className="container">
          <div className="sec-head">
            <div className="sec-marker">
              <span className="num">§ 02</span>
              <span className="rule"/>
              <span className="tag">How It Works</span>
            </div>
            <h2 style={{ marginTop: 0 }}>Connect once.<br/>Get managed forever.</h2>
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

      {/* ─── §03 FEATURES ─── */}
      <section className="section" id="features">
        <div className="container">
          <div className="sec-head">
            <div className="sec-marker">
              <span className="num">§ 03</span>
              <span className="rule"/>
              <span className="tag">What You Get</span>
            </div>
            <h2 style={{ marginTop: 0 }}>Everything you need.<br/>Nothing you don&apos;t.</h2>
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

      {/* ─── §04 COACHING REPORT ─── */}
      <section className="section" id="report">
        <div className="container">
          <div className="sec-head">
            <div className="sec-marker">
              <span className="num">§ 04</span>
              <span className="rule"/>
              <span className="tag">The Coaching Report</span>
            </div>
            <h2 style={{ marginTop: 0 }}>Real feedback after every stream.</h2>
            <p className="lead">
              Your manager reviews every VOD — scored, honest, and specific to what actually happened.
              Not &ldquo;be more engaging.&rdquo; Actual notes.
            </p>
          </div>

          <ReportVisual/>
        </div>
      </section>

      {/* ─── §05 RANKS ─── */}
      <section className="section" id="rank">
        <div className="container" style={{ textAlign: "center" }}>
          <div className="sec-marker" style={{ justifyContent: "center", maxWidth: 360, margin: "0 auto 28px" }}>
            <span className="rule" style={{ maxWidth: 80 }}/>
            <span className="num">§ 05</span>
            <span className="tag">Your Score · Your Rank</span>
            <span className="rule" style={{ maxWidth: 80 }}/>
          </div>
          <h2 style={{ marginTop: 0 }}>Level up, stream by stream.</h2>
          <p className="lead" style={{ margin: "18px auto 0" }}>
            Every stream earns a score. Your last 5 streams set your rank.
            Keep analyzing — keep climbing.
          </p>

          <div className="ranks">
            {ranks.map((r) => (
              <div className={`rank ${r.cls}`} key={r.cls}>
                <span className="range mono">{r.range}</span>
                <span className="name">{r.name}</span>
                <span className="bar"></span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "center" }}>
            <div className="rank-cap">
              <span className="range">90–100</span>
              <span className="name">LevlCast Legend</span>
            </div>
          </div>

          <p className="mono" style={{ color: "var(--ink-3)", marginTop: 36, fontSize: 12, letterSpacing: ".06em", textTransform: "uppercase" }}>
            Where does your stream score land?
          </p>
        </div>
      </section>

      {/* ─── §06 PRICING ─── */}
      <section className="section" id="pricing">
        <div className="container" style={{ textAlign: "center" }}>
          <div className="sec-marker" style={{ justifyContent: "center", maxWidth: 280, margin: "0 auto 28px" }}>
            <span className="rule" style={{ maxWidth: 80 }}/>
            <span className="num">§ 06</span>
            <span className="tag">Pricing</span>
            <span className="rule" style={{ maxWidth: 80 }}/>
          </div>
          <h2 style={{ marginTop: 0 }}>Simple, honest pricing.</h2>
          <p className="lead" style={{ margin: "18px auto 56px" }}>Start free. Upgrade when you&apos;re ready.</p>

          <div className="pricing">
            <div className="plan">
              <h3>Free</h3>
              <div className="plan-tag">See what your manager can do.</div>
              <div className="plan-price">
                <span className="amt">$0</span>
                <span className="per">/forever</span>
              </div>
              <ul>
                <li><CheckIcon color="var(--green)"/>1 VOD analysis per month</li>
                <li><CheckIcon color="var(--green)"/>AI coaching report + score</li>
                <li><CheckIcon color="var(--green)"/>5 clips total</li>
                <li><CheckIcon color="var(--green)"/>iOS &amp; web app</li>
              </ul>
              <Link href="/auth/login" className="btn btn-ghost">Get started free</Link>
            </div>

            <div className="plan featured">
              <span className="plan-badge">★ Most Popular · Founding Price</span>
              <h3>Pro</h3>
              <div className="plan-tag">Full management, every stream.</div>
              <div className="plan-price">
                <span className="amt">$9.99</span>
                <span className="per">/month</span>
              </div>
              <div className="plan-price-note">Locks in for life. Goes to $14.99 soon.</div>
              <ul>
                <li><CheckIcon color="var(--blue)"/>20 VOD analyses per month</li>
                <li><CheckIcon color="var(--blue)"/>20 clips per month</li>
                <li><CheckIcon color="var(--blue)"/>YouTube Shorts posting</li>
                <li><CheckIcon color="var(--blue)"/>Priority processing</li>
                <li><CheckIcon color="var(--blue)"/>Everything in Free</li>
              </ul>
              <Link href="/auth/login" className="btn btn-primary">Get Pro — $9.99/mo</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── §07 FAQ ─── */}
      <section className="section" id="faq">
        <div className="container">
          <div className="sec-head" style={{ textAlign: "center", margin: "0 auto 64px" }}>
            <div className="sec-marker" style={{ justifyContent: "center", maxWidth: 280, margin: "0 auto 28px" }}>
              <span className="rule" style={{ maxWidth: 80 }}/>
              <span className="num">§ 07</span>
              <span className="tag">FAQ</span>
              <span className="rule" style={{ maxWidth: 80 }}/>
            </div>
            <h2 style={{ marginTop: 0 }}>Got questions?</h2>
            <p className="lead" style={{ margin: "18px auto 0" }}>
              Built for streamers who want real growth. Growth stalls and no one tells you why.
              LevlCast is the feedback loop you&apos;ve been missing — specific notes on your actual stream, so every session makes you sharper than the last.
            </p>
          </div>

          <FaqAccordion items={faqItems} />
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section style={{ padding: "40px 0 0" }}>
        <div className="container">
          <div className="cta-strip">
            <div>
              <h2>Stream sharper. Starting tonight.</h2>
              <p className="lead">Get your first report free. No card, no setup, no overlays.</p>
            </div>
            <Link href="/auth/login" className="btn btn-primary">Get Your First Report Free <ArrowIcon/></Link>
          </div>
        </div>
      </section>

      <FooterLanding />
    </div>
  );
}
