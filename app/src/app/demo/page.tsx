import Link from "next/link";
import type { Metadata } from "next";
import { CoachReportCard } from "@/components/dashboard/coach-report-card";
import type { CoachReport } from "@/lib/analyze";

export const metadata: Metadata = {
  title: "Sample Coach Report",
  description: "See what a LevlCast coaching report looks like. No signup required.",
  robots: { index: false },
};

const DEMO_REPORT: CoachReport = {
  overall_score: 74,
  streamer_type: "gaming",
  energy_trend: "building",
  viewer_retention_risk: "medium",
  stream_story:
    "You started quiet and found your rhythm around 20 minutes in. The clutch defuse sequence at 45:12 was the best stretch of the stream. Chat lit up and your energy matched it. A long dead-air gap during loading screens at 23:40 stalled momentum for nearly 4 minutes, but you recovered well. Strong finish with a clear hook for next session.",
  strengths: [
    "**Clutch Commentary** - You called the 1v3 play-by-play in real time and it was genuinely exciting. That's the moment viewers clip. at 45:12.",
    "**Personality Under Pressure** - When the round went sideways at 51:30, you stayed funny instead of frustrated. That's rare and viewers notice. at 51:30.",
    "**Strong Second Half** - After the 23:40 dip, you came back with momentum and held it for the last 35 minutes.",
  ],
  improvements: [
    "**Dead Air on Loading Screens** - 4 minutes of near-silence at 23:40. That's the window where viewers drop off. Have a story or question ready for load times. at 23:40.",
    "**Slow Opening** - The first 8 minutes were setup noise and low-energy mumbling. Viewers who clicked from a clip were expecting what you showed at 45:12. at 8:10.",
    "**Missed Reactions** - Three big plays went by without any verbal reaction. Say something, even if it's just 'let's go'. The kill at 45:52 especially. at 45:52.",
  ],
  best_moment: {
    time: "45:12",
    description:
      "1v3 clutch defuse on Bind. You called every step out loud, chat spiked hard. Best sustained energy of the stream.",
  },
  recommendation:
    "Open your next stream with energy from second one. Watch the 45:12 clip before you go live. Then describe that play to chat like you're reliving it. Start hot. You already proved you can do it.",
  next_stream_goals: [
    "Prepare three 30-second stories to fill loading screens. Write them down before you go live.",
    "Open with a specific hook in the first 60 seconds. Tell chat what you're chasing this session.",
    "React out loud to every kill and every death. No silent plays.",
  ],
  cold_open: {
    score: "weak",
    note:
      "The first 8 minutes were setup noise and low-energy mumbling. You said 'let me just get this loaded' twice. Viewers who arrived early saw nothing compelling. Open with intent. Tell them what tonight is about before the first game starts.",
  },
  closing: {
    score: "strong",
    note:
      "You ended on a win and called it out specifically. Good close. You gave viewers a reason to come back with 'next session I'm pushing for top of the lobby'.",
  },
  anti_patterns: [
    {
      time: "28:15",
      type: "viewer_count_apology",
      quote: "Sorry there's only like 6 of you watching, this is kind of embarrassing",
      note:
        "This is one of the most damaging things you can say on stream. It signals to everyone watching that this isn't worth their time. The 6 people there chose to be there. Treat them like a packed room.",
    },
  ],
  dead_zones: [
    { time: "8:10", duration: 72 },
    { time: "23:40", duration: 248 },
    { time: "52:10", duration: 94 },
  ],
  trend_vs_history: {
    direction: "improving",
    note:
      "Your last 4 streams show a consistent upward trend. Scores went 58, 61, 67, now 74. The slow opening is a recurring flag but shorter each time. You're fixing the right things.",
  },
  shareable_win: {
    stat: "Chat spiked 4x during your clutch at 45:12",
    context:
      "That's the moment your viewers remember. Build your next title around it.",
  },
};

const DEMO_TRAJECTORY = [
  { score: 58, date: "2026-03-10" },
  { score: 61, date: "2026-03-18" },
  { score: 67, date: "2026-03-29" },
  { score: 71, date: "2026-04-14" },
  { score: 74, date: "2026-04-28", current: true },
];

export default function DemoPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#080B18", color: "#ECF1FA" }}>

      {/* Sticky demo banner */}
      <div style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "linear-gradient(135deg, rgba(148,61,255,0.95), rgba(180,70,200,0.95), rgba(242,97,121,0.95))",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.12)",
        padding: "10px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", background: "rgba(0,0,0,0.25)", padding: "3px 8px", borderRadius: 4 }}>
            Sample Report
          </span>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
            Connect Twitch to get a real report on your actual streams. Free.
          </span>
        </div>
        <Link
          href="/auth/login"
          style={{
            fontSize: 13, fontWeight: 700, padding: "8px 18px", borderRadius: 8,
            background: "#fff", color: "#0a0a14", textDecoration: "none",
            whiteSpace: "nowrap", flexShrink: 0,
          }}
        >
          Get Mine Free
        </Link>
      </div>

      {/* Page content */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px 80px" }}>

        {/* VOD header (fake) */}
        <div style={{ marginBottom: 24 }}>
          <Link href="/" style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
            <svg viewBox="0 0 24 24" fill="none" width="13" height="13"><path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Back to LevlCast
          </Link>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#ECF1FA", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
            Valorant ranked — finally hit Diamond | !discord
          </h1>
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
              Apr 28, 2026
            </span>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
              1h 33m
            </span>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, color: "#A3E635", background: "rgba(163,230,53,0.1)", border: "1px solid rgba(163,230,53,0.25)", padding: "2px 10px", borderRadius: 999 }}>
              74/100
            </span>
          </div>
        </div>

        <CoachReportCard
          report={DEMO_REPORT}
          previousScore={71}
          streak={5}
          isPersonalBest={true}
          streamerTitle="Rising Talent"
          isPro={true}
          streamDurationSeconds={5580}
          trajectory={DEMO_TRAJECTORY}
        />

        {/* Bottom CTA */}
        <div style={{
          marginTop: 48, padding: "36px 32px", borderRadius: 16,
          background: "linear-gradient(135deg, rgba(148,61,255,0.12), rgba(242,97,121,0.06))",
          border: "1px solid rgba(148,61,255,0.25)",
          textAlign: "center",
        }}>
          <p style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(148,61,255,0.8)", marginBottom: 14 }}>
            Ready for your own report?
          </p>
          <h2 style={{ fontSize: 26, fontWeight: 700, color: "#ECF1FA", margin: "0 0 12px", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
            Connect Twitch. Analyze your next VOD.
          </h2>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", margin: "0 0 28px", lineHeight: 1.6 }}>
            Free to start. No credit card. First report in under 10 minutes.
          </p>
          <Link
            href="/auth/login"
            style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              fontSize: 15, fontWeight: 700, padding: "14px 28px", borderRadius: 10,
              background: "linear-gradient(135deg, rgb(148,61,255) 0%, rgb(242,97,121) 100%)",
              color: "#fff", textDecoration: "none",
            }}
          >
            Get Your First Report Free
          </Link>
        </div>
      </div>
    </div>
  );
}
