import Link from "next/link";
import { Check, Play, ArrowRight, X } from "lucide-react";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";

/* ─── Real product features (mirrors lib/analyze.ts CoachReport) ─── */

const subScores = [
  { label: "ENERGY", value: 74, color: "#22D3EE" },
  { label: "ENGAGEMENT", value: 61, color: "#FBBF24" },
  { label: "CONSISTENCY", value: 70, color: "#A3E635" },
  { label: "CONTENT", value: 63, color: "#22D3EE" },
];

const ranks = [
  { range: "0–39",  label: "Fresh Streamer",     numeral: "I"   },
  { range: "40–54", label: "Rising Talent",      numeral: "II"  },
  { range: "55–69", label: "Consistent Creator", numeral: "III", you: true },
  { range: "70–79", label: "Crowd Favorite",     numeral: "IV"  },
  { range: "80–89", label: "Elite Entertainer",  numeral: "V"   },
  { range: "90–100", label: "LevlCast Legend",   numeral: "VI"  },
];

const problems = [
  {
    q: "Why am I not growing?",
    body: "You stream four nights a week and the numbers won't move. No one tells you why.",
    tag: "THE QUESTION EVERY STREAMER ASKS",
  },
  {
    q: "Why do viewers leave?",
    body: "People click in. They scroll your stream. They leave. You never know what made them bounce.",
    tag: "YOU CAN'T FIX WHAT YOU CAN'T SEE",
  },
  {
    q: "What am I doing wrong?",
    body: "You re-watch your own VODs and feel weird about it. No idea what to actually change.",
    tag: "SELF-CRITIQUE ≠ A COACH",
  },
];

const steps = [
  {
    num: "01",
    title: "Connect your channel",
    body: "One click on Twitch. We pull your VOD library automatically. Read-only — no overlay, no setup.",
    terminal: [
      { type: "ok", text: "Twitch · @your_channel  CONNECTED ✓" },
      { type: "neutral", text: "Pulling latest VOD…" },
      { type: "ok", text: "Permissions: read-only" },
    ],
  },
  {
    num: "02",
    title: "AI watches every minute",
    body: "Scored on four dimensions — energy, engagement, consistency, and content — with a rank tier out of six.",
    terminal: [
      { type: "neutral", text: "Analyzing 4h 12m VOD   2:46 / 4:12" },
      { type: "neutral", text: "Scoring  energy · engagement" },
      { type: "neutral", text: "Scoring  consistency · content" },
    ],
  },
  {
    num: "03",
    title: "Get your coach report",
    body: "Stream story, #1 priority fix, 3 strengths, 3 improvements, and 3 missions for your next stream.",
    terminal: [
      { type: "amber", text: "Priority fix assigned         1 OF 1" },
      { type: "ok", text: "3 strengths · 3 improvements" },
      { type: "ok", text: "Score 67/100 · ▲ +8 from last" },
    ],
  },
];

const compareLeft = [
  "Re-watch your own VOD and cringe — no idea what to actually fix.",
  "Vague advice from forums: \"engage more,\" \"find your niche.\"",
  "No record of what worked. No record of what didn't.",
  "You burn out before you ever see the trend line move.",
  "Same mistakes, every stream, for months.",
];

const compareRight = [
  "One specific priority fix per stream, ranked above everything else.",
  "Real timestamps with quotes — anti-patterns flagged from your actual VOD.",
  "Score 0–100 every stream. Watch it climb (or don't, and know why).",
  "Six rank tiers from Fresh Streamer to LevlCast Legend.",
  "Three concrete missions for your next session — not generic tips.",
];

const freeFeatures = [
  "1 VOD analysis per month",
  "Full coach report + score",
  "5 clips total",
  "iOS app + web",
];

const proFeatures = [
  "20 VOD analyses per month",
  "20 clips per month",
  "YouTube Shorts auto-post",
  "Score trend + rank progression",
  "Everything in Free",
];

/* ─── Mock UI components (used inside feature sections) ─── */

function ScoreCardMock() {
  return (
    <div className="ui-card-cyan p-5 shadow-[0_8px_40px_rgba(34,211,238,0.05)]">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/[0.05]">
        <div className="flex items-center gap-2 text-[10px] font-mono text-white/40 uppercase tracking-wider">
          <span className="w-2 h-2 rounded-full bg-rose-400/80" />
          <span className="w-2 h-2 rounded-full bg-amber-400/80" />
          <span className="w-2 h-2 rounded-full bg-lime-400/80" />
          <span className="ml-2">score · fri-night-eldenring</span>
        </div>
        <span className="text-[10px] font-mono font-bold text-ink-cyan bg-cyan/[0.08] border border-border-cyan px-2 py-0.5 rounded">67 / 100</span>
      </div>
      <div className="space-y-2.5 mb-5">
        {subScores.map((s) => (
          <div key={s.label} className="flex items-center gap-3">
            <span className="text-[10px] font-mono font-semibold text-white/45 w-24">{s.label}</span>
            <div className="flex-1 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${s.value}%`, backgroundColor: s.color }} />
            </div>
            <span className="text-sm font-mono font-bold text-white/90 w-7 text-right">{s.value}</span>
          </div>
        ))}
      </div>
      <div className="pt-4 border-t border-white/[0.05]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-mono uppercase tracking-wider text-white/40">Rank Ladder</span>
          <span className="text-[11px] font-bold text-ink-cyan">Consistent Creator</span>
        </div>
        <div className="flex items-center gap-1">
          {["Fresh", "Rising", "Consistent", "Crowd Fav", "Elite", "Legend"].map((r, i) => (
            <div key={r} className="flex-1 flex flex-col items-center gap-1.5">
              <div className={`h-1 w-full rounded-full ${i === 2 ? "bg-ink-cyan" : "bg-white/[0.06]"}`} />
              <span className={`text-[8px] font-mono uppercase tracking-wide ${i === 2 ? "text-ink-cyan" : "text-white/25"}`}>{r}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CoachReportMock() {
  return (
    <div className="ui-card p-5">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/[0.05]">
        <div className="flex items-center gap-2 text-[10px] font-mono text-white/40 uppercase tracking-wider">
          <span className="w-2 h-2 rounded-full bg-rose-400/80" />
          <span className="w-2 h-2 rounded-full bg-amber-400/80" />
          <span className="w-2 h-2 rounded-full bg-lime-400/80" />
          <span className="ml-2">coach report · fri-night-eldenring</span>
        </div>
        <span className="text-[10px] font-mono font-bold text-ink-cyan border border-border-cyan px-2 py-0.5 rounded">FULL REPORT</span>
      </div>
      <div className="space-y-3">
        <div className="rounded-lg p-3 flex items-start gap-3" style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.2)" }}>
          <span className="font-mono font-bold text-ink-amber text-sm flex-shrink-0">1</span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-wider text-ink-amber mb-1">#1 Priority Fix · 00:00</p>
            <p className="text-sm text-white/90 leading-snug">Shorten the opening. 6m 42s of setup before gameplay — open on a hook.</p>
          </div>
        </div>
        <div className="rounded-lg p-3 flex items-start gap-3" style={{ background: "rgba(163,230,53,0.04)", border: "1px solid rgba(163,230,53,0.18)" }}>
          <span className="font-mono font-bold text-ink-lime text-sm flex-shrink-0">+</span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-wider text-ink-lime mb-1">Strength · 1 of 3 · 2:11</p>
            <p className="text-sm text-white/90 leading-snug">Commentary during Malenia phase 2 was your sharpest of the week.</p>
          </div>
        </div>
        <div className="rounded-lg p-3 flex items-start gap-3" style={{ background: "rgba(251,113,133,0.04)", border: "1px solid rgba(251,113,133,0.18)" }}>
          <span className="font-mono font-bold text-ink-rose text-sm flex-shrink-0">~</span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-wider text-ink-rose mb-1">Anti-pattern · 4:12</p>
            <p className="text-sm text-white/90 leading-snug">3rd stream in a row ending mid-attempt — write a closing beat.</p>
          </div>
        </div>
        <div className="rounded-lg p-3 flex items-start gap-3" style={{ background: "rgba(34,211,238,0.04)", border: "1px solid rgba(34,211,238,0.18)" }}>
          <span className="font-mono font-bold text-ink-cyan text-sm flex-shrink-0">→</span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-wider text-ink-cyan mb-1">Next-stream Mission · 1 of 3</p>
            <p className="text-sm text-white/90 leading-snug">Open on the attempt that ended tonight. Carry the story forward.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrendChartMock() {
  // SVG trend line — slight rise from 50 to 78
  const points = [
    [0, 65], [60, 60], [120, 68], [180, 62], [240, 70], [300, 67], [360, 75], [420, 72], [480, 80],
  ];
  const pathD = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${110 - y}`).join(" ");
  const fillD = `${pathD} L480,110 L0,110 Z`;

  return (
    <div className="ui-card p-5">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/[0.05]">
        <span className="text-[10px] font-mono uppercase tracking-wider text-white/40">stream score · last 12 streams</span>
        <span className="text-[10px] font-mono font-bold text-ink-cyan border border-border-cyan px-2 py-0.5 rounded">CONSISTENT</span>
      </div>
      <div className="flex items-baseline gap-3 mb-4">
        <span className="text-4xl font-extrabold text-white tracking-tight">67</span>
        <span className="text-sm font-mono font-bold text-ink-lime">▲ +8 from last</span>
      </div>
      <div className="relative">
        <svg viewBox="0 0 480 130" className="w-full h-auto">
          {/* Tier bands */}
          <line x1="0" y1="32" x2="480" y2="32" stroke="rgba(255,255,255,0.04)" strokeDasharray="2,4" />
          <line x1="0" y1="55" x2="480" y2="55" stroke="rgba(255,255,255,0.04)" strokeDasharray="2,4" />
          <line x1="0" y1="78" x2="480" y2="78" stroke="rgba(255,255,255,0.04)" strokeDasharray="2,4" />
          <text x="475" y="30" fontSize="8" fontFamily="monospace" fill="rgba(163,230,53,0.4)" textAnchor="end">ELITE 80+</text>
          <text x="475" y="53" fontSize="8" fontFamily="monospace" fill="rgba(34,211,238,0.4)" textAnchor="end">CROWD FAV 70+</text>
          <text x="475" y="76" fontSize="8" fontFamily="monospace" fill="rgba(255,255,255,0.3)" textAnchor="end">CONSISTENT 55+</text>
          {/* Fill */}
          <path d={fillD} fill="url(#cyanGrad)" opacity="0.25" />
          <defs>
            <linearGradient id="cyanGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#22D3EE" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Line */}
          <path d={pathD} stroke="#22D3EE" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          {/* Points */}
          {points.map(([x, y], i) => (
            <circle key={i} cx={x} cy={110 - y} r="3" fill="#22D3EE" />
          ))}
        </svg>
      </div>
      <div className="mt-4 pt-3 border-t border-white/[0.05] flex items-center gap-4 text-[10px] font-mono uppercase tracking-wider">
        <span className="flex items-center gap-1.5"><span className="w-3 h-px bg-ink-cyan" /><span className="text-white/40">Score Trend</span></span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-px bg-ink-lime" /><span className="text-white/40">Rank Tier Bands</span></span>
      </div>
    </div>
  );
}

function ClipsListMock() {
  const clips = [
    { title: "Malenia phase 2 — first clear", cat: "CLUTCH",       catColor: "text-ink-amber",    time: "2:11:42", status: "POSTED",  statusColor: "text-ink-lime" },
    { title: "\"That can't be real\" reaction", cat: "COMEDY",     catColor: "text-ink-amber",    time: "1:54:11", status: "QUEUED",  statusColor: "text-white/45" },
    { title: "Parry timing explainer",          cat: "EDUCATIONAL", catColor: "text-ink-cyan",    time: "2:38:22", status: "READY",   statusColor: "text-ink-cyan" },
    { title: "Opening hype build-up",           cat: "HYPE",       catColor: "text-ink-rose",    time: "0:11:08", status: "READY",   statusColor: "text-ink-cyan" },
  ];

  return (
    <div className="ui-card p-5">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/[0.05]">
        <div className="flex items-center gap-2 text-[10px] font-mono text-white/40 uppercase tracking-wider">
          <span className="w-2 h-2 rounded-full bg-rose-400/80" />
          <span className="w-2 h-2 rounded-full bg-amber-400/80" />
          <span className="w-2 h-2 rounded-full bg-lime-400/80" />
          <span className="ml-2">clips · auto-detected</span>
        </div>
        <span className="text-[10px] font-mono font-bold text-ink-cyan border border-border-cyan px-2 py-0.5 rounded">SHORTS READY</span>
      </div>
      <div className="space-y-2">
        {clips.map((c) => (
          <div key={c.title} className="flex items-center gap-3 py-2">
            <div className="w-12 h-9 rounded bg-gradient-to-br from-ink-cyan/30 to-ink-cyan/5 flex-shrink-0 relative overflow-hidden">
              <span className="absolute bottom-0.5 right-1 text-[8px] font-mono font-bold text-white/80">0:28</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white/90 leading-tight truncate">{c.title}</p>
              <p className="text-[10px] font-mono uppercase tracking-wider text-white/40 mt-0.5">
                <span className={c.catColor}>{c.cat}</span>
                <span className="mx-1.5">·</span>
                <span>{c.time}</span>
              </p>
            </div>
            <span className={`text-[9px] font-mono font-bold uppercase tracking-wider ${c.statusColor}`}>{c.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Page ─── */

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-bg-deep text-white">
      <NavBar />

      {/* ─── Hero ─── */}
      <section className="relative pt-32 md:pt-36 pb-24 dot-bg overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-ink-cyan/20 to-transparent pointer-events-none" />
        <div className="absolute -top-40 -left-40 w-[700px] h-[700px] bg-ink-cyan/[0.05] rounded-full blur-[140px] pointer-events-none" />

        <div className="relative max-w-[1180px] mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
            <div className="lg:col-span-6">
              <div className="ui-tag mb-7">AI VOD COACH · BUILT FOR STREAMERS</div>
              <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-[-2px] leading-[1.02] mb-6">
                Fix your streams.
                <br />
                <span className="text-lime-accent">Level up your rank.</span>
              </h1>
              <p className="text-base md:text-lg text-white/55 max-w-[540px] mb-9 leading-relaxed">
                LevlCast watches your VODs and scores every stream 0–100 — with a coach report that tells you what to fix, what to keep, and what to try next stream. Climb from Fresh Streamer to LevlCast Legend.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mb-5">
                <Link href="/auth/login" className="btn-cyan inline-flex items-center justify-center gap-2.5 group">
                  Analyze my stream
                  <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <a href="#how-it-works" className="btn-ghost-cyan inline-flex items-center justify-center gap-2.5">
                  <Play size={14} fill="currentColor" />
                  See how it works
                </a>
              </div>
              <p className="text-xs font-mono text-white/35 tracking-wide">FREE PLAN · 1 VOD / MONTH · NO CREDIT CARD</p>
            </div>

            <div className="lg:col-span-6">
              <div className="space-y-4">
                <ScoreCardMock />
                <div className="ui-card p-4 flex items-start gap-3">
                  <span className="font-mono text-2xl font-extrabold text-ink-amber leading-none flex-shrink-0">1</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-ink-amber mb-1">Priority Fix · This Stream</p>
                    <p className="text-sm text-white/85 leading-snug">Your opening ran 6m 42s of setup. Open on the Malenia attempt — carry the story forward.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── The Problem ─── */}
      <section className="py-24 border-t border-border-soft">
        <div className="max-w-[1180px] mx-auto px-6">
          <div className="text-center mb-16">
            <div className="ui-tag mb-5 justify-center inline-flex">THE PROBLEM</div>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight mb-5">
              You&apos;re streaming.
              <br className="sm:hidden" />
              <span className="text-cyan-accent"> Why aren&apos;t you growing?</span>
            </h2>
            <p className="text-white/55 max-w-[640px] mx-auto leading-relaxed">
              Most streamers stuck under 100 viewers aren&apos;t bad — they just can&apos;t see what&apos;s killing their growth. You can&apos;t fix what you can&apos;t measure.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {problems.map((p) => (
              <div key={p.q} className="section-card p-7">
                <h3 className="text-xl font-bold text-ink-rose leading-snug mb-3">&ldquo;{p.q}&rdquo;</h3>
                <p className="text-sm text-white/60 leading-relaxed mb-5">{p.body}</p>
                <p className="text-[10px] font-mono uppercase tracking-wider text-white/30">{p.tag}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section id="how-it-works" className="py-24 border-t border-border-soft hex-bg">
        <div className="max-w-[1180px] mx-auto px-6">
          <div className="text-center mb-16">
            <div className="ui-tag mb-5 justify-center inline-flex">HOW IT WORKS · 3 STEPS</div>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight mb-5">
              From VOD to <span className="text-cyan-accent">actionable fix</span>.
            </h2>
            <p className="text-white/55 max-w-[560px] mx-auto leading-relaxed">
              No setup ceremony. No giant onboarding. Connect, upload, get coached.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {steps.map((s) => (
              <div key={s.num} className="section-card p-7">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-ink-cyan/10 border border-border-cyan mb-5">
                  <span className="font-mono font-bold text-ink-cyan text-sm">{s.num}</span>
                </div>
                <h3 className="text-lg font-bold mb-2">{s.title}</h3>
                <p className="text-sm text-white/55 leading-relaxed mb-5">{s.body}</p>
                <div className="mock-terminal">
                  {s.terminal.map((line, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className={
                        line.type === "ok"      ? "text-ink-lime" :
                        line.type === "amber"   ? "text-ink-amber" :
                        "text-white/30"
                      }>{line.type === "ok" ? "✓" : line.type === "amber" ? "!" : "~"}</span>
                      <span>{line.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features intro ─── */}
      <section id="features" className="pt-24 pb-12">
        <div className="max-w-[900px] mx-auto px-6 text-center">
          <div className="ui-tag mb-5 justify-center inline-flex">WHAT YOU GET</div>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight mb-5">
            Every stream becomes <span className="text-lime-accent">a lesson</span>.
          </h2>
          <p className="text-white/55 leading-relaxed">
            Four tools that turn your VODs into a coaching loop. Scannable. Specific. Actually useful.
          </p>
        </div>
      </section>

      {/* ─── Feature 1: Stream Score (text left, card right) ─── */}
      <section className="py-16">
        <div className="max-w-[1180px] mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-5">
              <div className="ui-tag mb-5">STREAM SCORE · 0–100</div>
              <h3 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight mb-5">
                One score. Four dimensions. Six ranks.
              </h3>
              <p className="text-white/55 leading-relaxed mb-7">
                Every stream gets a 0–100 score broken into energy, engagement, consistency, and content — then placed on a six-tier rank ladder from Fresh Streamer to LevlCast Legend.
              </p>
              <ul className="space-y-3">
                {[
                  "Sub-scores for energy, engagement, consistency, content",
                  "Rank tier with points to next rank visible on every page",
                  "Score delta vs your last stream (e.g. \"+8 from last\")",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-white/75">
                    <Check size={15} className="text-ink-lime flex-shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:col-span-7"><ScoreCardMock /></div>
          </div>
        </div>
      </section>

      {/* ─── Feature 2: Coach Report (card left, text right) ─── */}
      <section className="py-16 border-t border-border-soft">
        <div className="max-w-[1180px] mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 lg:order-1 order-2"><CoachReportMock /></div>
            <div className="lg:col-span-5 lg:order-2 order-1">
              <div className="ui-tag mb-5" style={{ color: "#A3E635" }}>COACH REPORT</div>
              <h3 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight mb-5">
                A real coach, not a chart.
              </h3>
              <p className="text-white/55 leading-relaxed mb-7">
                Every VOD gets a written report — the stream story, opening &amp; closing notes, #1 priority fix, 3 strengths, 3 improvements, 3 next-stream missions, best moment, and an anti-pattern watch-list.
              </p>
              <ul className="space-y-3">
                {[
                  "Stream story — what actually happened, in plain English",
                  "One priority fix, ranked above everything else",
                  "Anti-patterns you repeat across streams, flagged with quotes",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-white/75">
                    <Check size={15} className="text-ink-lime flex-shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Feature 3: Score Trend (text left, chart right) ─── */}
      <section className="py-16 border-t border-border-soft">
        <div className="max-w-[1180px] mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-5">
              <div className="ui-tag mb-5">SCORE TREND</div>
              <h3 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight mb-5">
                Watch your score climb.
              </h3>
              <p className="text-white/55 leading-relaxed mb-7">
                Score delta on every stream — &ldquo;+8 from last,&rdquo; &ldquo;–3 from last.&rdquo; See which fixes actually moved the needle, which rank tier you&apos;re closing in on, and when you graduate.
              </p>
              <ul className="space-y-3">
                {[
                  "Score delta vs previous stream on every report",
                  "Rank tier progression visible on every page",
                  "Sub-score history — spot which dimension is lagging",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-white/75">
                    <Check size={15} className="text-ink-lime flex-shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:col-span-7"><TrendChartMock /></div>
          </div>
        </div>
      </section>

      {/* ─── Feature 4: Clip Detection (clips left, text right) ─── */}
      <section className="py-16 border-t border-border-soft">
        <div className="max-w-[1180px] mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 lg:order-1 order-2"><ClipsListMock /></div>
            <div className="lg:col-span-5 lg:order-2 order-1">
              <div className="ui-tag mb-5" style={{ color: "#A3E635" }}>CLIP DETECTION + SHORTS</div>
              <h3 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight mb-5">
                Hype, comedy, clutch, educational.
              </h3>
              <p className="text-white/55 leading-relaxed mb-7">
                We find your best moments and sort them into four categories — then auto-post to YouTube Shorts so your clips keep working while you sleep.
              </p>
              <ul className="space-y-3">
                {[
                  "Auto-categorized: hype, comedy, clutch, educational",
                  "One-tap YouTube Shorts auto-post",
                  "Every clip links back to the VOD timestamp",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-white/75">
                    <Check size={15} className="text-ink-lime flex-shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ─── The Ladder ─── */}
      <section className="py-24 border-t border-border-soft hex-bg">
        <div className="max-w-[1180px] mx-auto px-6">
          <div className="text-center mb-14">
            <div className="ui-tag mb-5 justify-center inline-flex">THE LADDER</div>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight mb-5">
              Six ranks. <span className="text-lime-accent">One goal.</span>
            </h2>
            <p className="text-white/55 max-w-[640px] mx-auto leading-relaxed">
              Your stream score places you on a six-tier ladder. Every VOD either earns you points toward the next rank — or tells you exactly why it didn&apos;t.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {ranks.map((r) => (
              <div key={r.label} className={`relative section-card p-5 text-center ${r.you ? "border-ink-cyan shadow-[0_0_30px_rgba(34,211,238,0.15)]" : ""}`} style={r.you ? { borderColor: "rgba(34,211,238,0.5)" } : {}}>
                {r.you && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold uppercase tracking-widest text-bg-deep bg-ink-cyan px-2 py-0.5 rounded">YOU</span>
                )}
                <p className="text-[10px] font-mono text-white/35 mb-3">{r.range}</p>
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg mb-3 font-mono font-bold ${r.you ? "bg-ink-cyan/15 text-ink-cyan border border-border-cyan" : "bg-white/[0.04] text-white/50 border border-white/[0.06]"}`}>
                  {r.numeral}
                </div>
                <p className={`text-sm font-bold leading-tight ${r.you ? "text-white" : "text-white/70"}`}>{r.label}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-[10px] font-mono uppercase tracking-widest text-white/30 mt-10">
            Score delta shown on every stream · See your progression, not just your numbers
          </p>
        </div>
      </section>

      {/* ─── Why LevlCast ─── */}
      <section className="py-24 border-t border-border-soft">
        <div className="max-w-[1180px] mx-auto px-6">
          <div className="text-center mb-14">
            <div className="ui-tag mb-5 justify-center inline-flex">WHY LEVLCAST</div>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight mb-5">
              Stop guessing. <span className="text-cyan-accent">Start fixing.</span>
            </h2>
            <p className="text-white/55 max-w-[640px] mx-auto leading-relaxed">
              Most streamers grind blind. They re-watch their own VODs, feel weird about it, and change nothing.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-[940px] mx-auto">
            <div className="section-card p-7">
              <div className="flex items-center gap-2 mb-5">
                <X size={14} className="text-ink-rose" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-ink-rose">Grinding without a coach</span>
              </div>
              <ul className="space-y-3">
                {compareLeft.map((c) => (
                  <li key={c} className="flex items-start gap-2.5 text-sm text-white/55 leading-relaxed">
                    <X size={13} className="text-ink-rose flex-shrink-0 mt-1" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="section-card p-7" style={{ borderColor: "rgba(34,211,238,0.3)" }}>
              <div className="flex items-center gap-2 mb-5">
                <Check size={14} className="text-ink-cyan" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-ink-cyan">Coaching with LevlCast</span>
              </div>
              <ul className="space-y-3">
                {compareRight.map((c) => (
                  <li key={c} className="flex items-start gap-2.5 text-sm text-white/85 leading-relaxed">
                    <Check size={13} className="text-ink-cyan flex-shrink-0 mt-1" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section id="pricing" className="py-24 border-t border-border-soft">
        <div className="max-w-[1180px] mx-auto px-6">
          <div className="text-center mb-14">
            <div className="ui-tag mb-5 justify-center inline-flex">PRICING · NO RISK</div>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight mb-5">
              Less than your monthly <span className="text-lime-accent">Twitch sub</span>.
            </h2>
            <p className="text-white/55 max-w-[560px] mx-auto leading-relaxed">
              One free report, no card. Upgrade only when you&apos;re ready to climb.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-[820px] mx-auto">
            {/* Free */}
            <div className="section-card p-8 flex flex-col">
              <h3 className="text-lg font-bold mb-1">Free</h3>
              <p className="text-sm text-white/50 mb-7">For streamers getting started.</p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-5xl font-extrabold text-white tracking-tight">$0</span>
                <span className="text-sm text-white/40">/ month</span>
              </div>
              <p className="text-xs text-white/40 mb-8">No card required · Free forever</p>
              <ul className="space-y-3 mb-8 flex-1">
                {freeFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-white/70">
                    <Check size={15} className="text-ink-lime flex-shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link href="/auth/login" className="btn-ghost-cyan text-center block">
                Start free
              </Link>
            </div>

            {/* Pro */}
            <div className="section-card p-8 flex flex-col relative" style={{ borderColor: "rgba(34,211,238,0.4)", boxShadow: "0 0 60px rgba(34,211,238,0.08)" }}>
              <span className="absolute -top-2.5 left-6 text-[9px] font-mono font-bold uppercase tracking-widest text-bg-deep bg-ink-cyan px-2.5 py-1 rounded">MOST POPULAR</span>
              <h3 className="text-lg font-bold mb-1">Pro</h3>
              <p className="text-sm text-white/50 mb-7">For streamers serious about climbing.</p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-5xl font-extrabold text-ink-cyan tracking-tight">$9.99</span>
                <span className="text-sm text-white/40">/ month</span>
              </div>
              <p className="text-xs text-white/40 mb-8">Founding price · Cancel anytime</p>
              <ul className="space-y-3 mb-8 flex-1">
                {proFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-white/85">
                    <Check size={15} className="text-ink-lime flex-shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link href="/auth/login" className="btn-cyan text-center block">
                Upgrade to Pro
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="py-28 border-t border-border-soft dot-bg relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-ink-cyan/20 to-transparent pointer-events-none" />
        <div className="relative max-w-[760px] mx-auto px-6 text-center">
          {/* Trust bar */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-12 text-[10px] font-mono uppercase tracking-widest text-white/40">
            <span className="flex items-center gap-1.5"><Check size={11} className="text-ink-lime" />No card on free</span>
            <span className="text-white/15">·</span>
            <span className="flex items-center gap-1.5"><Check size={11} className="text-ink-lime" />Cancel anytime</span>
            <span className="text-white/15">·</span>
            <span className="flex items-center gap-1.5"><Check size={11} className="text-ink-lime" />Twitch &amp; YouTube</span>
          </div>

          <div className="ui-tag mb-5 justify-center inline-flex">THE NEXT STREAM IS THE ONE</div>
          <h2 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.05] mb-6">
            Score your stream.
            <br />
            <span className="text-lime-accent">Climb the ladder.</span>
          </h2>
          <p className="text-white/55 mb-10 max-w-[480px] mx-auto leading-relaxed">
            Drop in a VOD. Get a coach report, a score, and a rank. Free plan — no card.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/auth/login" className="btn-cyan inline-flex items-center gap-2.5 group">
              Analyze my stream
              <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <a href="#how-it-works" className="btn-ghost-cyan inline-flex items-center gap-2.5">
              <Play size={14} fill="currentColor" />
              See how it works
            </a>
          </div>
          <p className="text-xs font-mono text-white/35 tracking-wide mt-6">FREE PLAN · 1 VOD / MONTH · CONNECTS WITH TWITCH &amp; YOUTUBE</p>
        </div>
      </section>

      <Footer />
    </main>
  );
}
