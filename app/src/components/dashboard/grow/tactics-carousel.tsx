"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import Link from "next/link";

interface Tactic {
  tag: string;
  tagColor: string;
  title: string;
  body: string;
  stat?: string;
  statLabel?: string;
  href?: string;
  hrefLabel?: string;
  internal?: boolean;
}

const TACTICS: Tactic[] = [
  {
    tag: "Biggest Opportunity",
    tagColor: "text-green-400",
    title: "Multistream to TikTok, YouTube, and Kick simultaneously",
    body: "Twitch won't push you to new viewers. Its discovery is nearly dead for small channels. TikTok Live, YouTube Live, and Kick all have active recommendation engines. Use Restream.io or OBS to broadcast everywhere at once. 37% of top creators already do this.",
    stat: "37%",
    statLabel: "of top creators now multistream",
    href: "https://restream.io",
    hrefLabel: "Try Restream",
  },
  {
    tag: "Clips",
    tagColor: "text-accent-light",
    title: "Post clips 3–5x per week, not once",
    body: "Channels that post consistently 3–5 times per week get 1.5x more recommendations than irregular posters. On TikTok and YouTube Shorts, every 59,000 views converts to roughly 1,000 new Twitch followers. Your clips are already made. Just post them.",
    stat: "59K",
    statLabel: "views = ~1,000 new Twitch followers",
    href: "/dashboard/clips",
    hrefLabel: "See your clips",
    internal: true,
  },
  {
    tag: "Consistency",
    tagColor: "text-yellow-400",
    title: "Stream 3–5 days a week at the same time",
    body: "The data shows 3–5 days per week is the sweet spot. Streaming the same days and times trains viewers to show up. People who know your schedule convert to regulars at much higher rates. Cancellations do more damage than missing a day.",
    stat: "3–5x",
    statLabel: "per week is the data-backed sweet spot",
  },
  {
    tag: "Discoverability",
    tagColor: "text-blue-400",
    title: "Stream off-peak hours: 47% less competition",
    body: "Streaming between 10 AM–3 PM local time results in 47% less competition in the Twitch directory. For small channels, being visible on page 1 of a game category matters more than streaming when the most people are online.",
    stat: "47%",
    statLabel: "less competition streaming 10AM–3PM",
  },
  {
    tag: "Game Selection",
    tagColor: "text-purple-400",
    title: "Own a niche game instead of competing in Fortnite",
    body: "Streaming popular games like Fortnite or Valorant puts you at the bottom of thousands of channels. Niche categories average lower viewer counts but dramatically faster follower growth. Streams tagged 'First Playthrough' see 22% higher follower conversion.",
    stat: "22%",
    statLabel: "higher conversion with 'First Playthrough' tag",
  },
  {
    tag: "Retention",
    tagColor: "text-red-400",
    title: "Twitch weights retention 4x more than total views",
    body: "Twitch's recommendation algorithm weighs viewer retention 4x heavier than raw view count. Streams with 45+ minute average view duration get 3.2x more recommendations. A 2-hour stream with 80% retention beats a 6-hour stream with 40% retention every time.",
    stat: "4x",
    statLabel: "retention weighting vs. raw view count",
  },
  {
    tag: "Stream Length",
    tagColor: "text-orange-400",
    title: "2–4 hour streams hit the algorithm sweet spot",
    body: "Streams under 1 hour don't give enough discovery time. Streams over 4 hours tend to see engagement drop-off. The 2–4 hour range maximizes both retention rate and total watch time, the two signals Twitch's algorithm cares most about.",
    stat: "2–4hrs",
    statLabel: "optimal stream length per session",
  },
  {
    tag: "Chat Engagement",
    tagColor: "text-pink-400",
    title: "Respond to chat: viewers who chat return 50% more",
    body: "Twitch data shows viewers who chat during their first visit are 50% more likely to return. Streams with high chat activity see up to 30% higher viewer retention. For small channels under 50 viewers, you have an advantage: you can respond to everyone.",
    stat: "50%",
    statLabel: "more likely to return if they chatted once",
  },
  {
    tag: "Energy Match",
    tagColor: "text-accent-light",
    title: "Stream like your best clips every single time",
    body: "When someone finds your clip on TikTok and visits your Twitch, they expect that version of you. If your stream energy doesn't match your clips, they leave and don't follow. Your peak moments define your brand. Replicate them live.",
    href: "/dashboard/clips",
    hrefLabel: "See your top clips",
    internal: true,
  },
  {
    tag: "Raids",
    tagColor: "text-muted",
    title: "Raids are networking, not growth. Adjust your expectations",
    body: "Data shows even large raids of 500+ viewers typically convert to just 1–2 new followers. Raids work as relationship-building tools with other small streamers, not as growth engines. Use them to network, not to spike your numbers.",
    stat: "1–2",
    statLabel: "average new followers per raid",
  },
];

export function TacticsCarousel() {
  const [index, setIndex] = useState(0);

  const prev = () => setIndex((i) => (i - 1 + TACTICS.length) % TACTICS.length);
  const next = () => setIndex((i) => (i + 1) % TACTICS.length);

  const tactic = TACTICS[index];

  return (
    <div
      className="rounded-2xl overflow-hidden relative h-full flex flex-col"
      style={{ background: "rgba(10,9,20,0.98)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="absolute top-0 left-0 w-24 h-px" style={{ background: "linear-gradient(90deg, rgba(139,92,246,0.6), transparent)" }} />

      <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-violet-400 mb-0.5">This Week's Tactics</p>
          <h2 className="text-sm font-bold text-white">Small moves. Real growth.</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold tabular-nums text-white/40">{index + 1} / {TACTICS.length}</span>
          <button onClick={prev} aria-label="Previous" className="p-1.5 rounded-lg transition-colors border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.12]">
            <ChevronLeft size={14} className="text-white/50" />
          </button>
          <button onClick={next} aria-label="Next" className="p-1.5 rounded-lg transition-colors border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.12]">
            <ChevronRight size={14} className="text-white/50" />
          </button>
        </div>
      </div>

      <div className="px-6 py-5 flex-1">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-[10px] font-extrabold uppercase tracking-widest mb-3 ${tactic.tagColor}`}>{tactic.tag}</span>
        <h3 className="text-base sm:text-lg font-black text-white mb-2 leading-snug tracking-tight">{tactic.title}</h3>
        <p className="text-sm text-white/55 leading-relaxed mb-4">{tactic.body}</p>

        {tactic.stat && (
          <div
            className="rounded-xl px-4 py-3 mb-4 flex items-center gap-3 relative overflow-hidden"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderLeft: "2px solid rgba(139,92,246,0.5)" }}
          >
            <span className={`text-3xl font-black tabular-nums leading-none ${tactic.tagColor}`}>{tactic.stat}</span>
            <span className="text-xs text-white/50 leading-relaxed">{tactic.statLabel}</span>
          </div>
        )}

        {tactic.href && (
          tactic.internal ? (
            <Link href={tactic.href} className="inline-flex items-center gap-1 text-xs font-bold text-violet-400 hover:text-violet-300 transition-colors">
              {tactic.hrefLabel} →
            </Link>
          ) : (
            <a href={tactic.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-violet-400 hover:text-violet-300 transition-colors">
              {tactic.hrefLabel} <ExternalLink size={10} />
            </a>
          )
        )}
      </div>

      {/* Dot indicators */}
      <div className="flex items-center justify-center gap-1.5 pb-5">
        {TACTICS.map((_, i) => (
          <button
            key={i}
            aria-label={`Tactic ${i + 1}`}
            onClick={() => setIndex(i)}
            className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-violet-400" : "w-1.5 bg-white/15 hover:bg-white/25"}`}
          />
        ))}
      </div>
    </div>
  );
}
