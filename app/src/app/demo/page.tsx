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
    "This stream had a clear turning point. The first half was drift. Then 45:12 happened and everything shifted.",
  strengths: [
    "**Clutch Commentary** - You narrated the 1v3 in real time as it was happening. Chat spiked immediately. That's exactly what gets clipped and sent around. at 45:12.",
    "**Staying Loose** - Round collapsed at 51:30 and you stayed funny instead of going quiet. That's harder than it looks. Regulars notice that. at 51:30.",
    "**Late Hold** - You locked back in after the 23:40 dip and held energy for the last 30 minutes. Most people don't recover that cleanly.",
  ],
  improvements: [
    "**Wasted Downtime** - Four minutes of near-silence during loading at 23:40. Have one story ready for every load screen. That gap is where people leave. at 23:40.",
    "**Cold Start** - Still warming up at 8:10 with no hook. Viewers who clicked from a clip expect what you showed at 45:12. Give it to them sooner. at 8:10.",
    "**Silent Plays** - Three big moments passed with no verbal reaction. Just say something. Anything. The kill at 45:52 especially needed a callout. at 45:52.",
  ],
  best_moment: {
    time: "45:12",
    description:
      "You'd been quiet through most of the round, so the live callouts landed harder when they came. At 45:12 you talked through every decision in real time and chat felt it instantly. Next time, start narrating your read before you make the move, not as it happens.",
  },
  punch_line: "You had everything you needed for a viral clip and kept pulling back right before it landed.",
  recommendation:
    "Your best moments happen when you stop reacting and start leading the moment out loud. The 45:12 clutch worked because you were commentating the decision, not just the result. Do that from the first game.",
  next_stream_goals: [
    "Write down two stories before you go live. Use one during every loading screen.",
    "In the first 60 seconds, tell chat exactly what you're chasing tonight.",
    "Narrate your read before you make the play. Not after.",
  ],
  cold_open: {
    score: "weak",
    note:
      "Eight minutes of setup and low-energy warmup with no real hook. By the time you engaged, some early arrivals had already left.",
  },
  closing: {
    score: "strong",
    note:
      "Ended on a win with clear energy and gave chat a specific reason to come back. Clean finish.",
  },
  anti_patterns: [
    {
      time: "28:15",
      type: "viewer_count_apology",
      quote: "Sorry there's only like 6 of you watching, this is kind of embarrassing",
      note:
        "Those 6 people chose to show up. Calling it out makes them feel like they made a bad call. Never do this.",
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
      "Four streams in a row trending up. The cold start keeps showing up but it's getting shorter each time. You're fixing the right things.",
  },
  shareable_win: {
    stat: "Chat spiked 4x during the clutch at 45:12",
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
            Valorant ranked, finally hit Diamond | !discord
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
