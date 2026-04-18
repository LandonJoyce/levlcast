"use client";

type PeakCategory = "hype" | "funny" | "educational" | "emotional";
type StreamerType = "gaming" | "just_chatting" | "irl" | "variety" | "educational";

interface Archetype {
  label: string;
  tagline: string;
  description: string;
  color: string;
  border: string;
}

// Combined archetype matrix: streamer type + dominant peak category
// Key format: `${streamerType}_${peakCategory}` with fallbacks
const ARCHETYPES: Record<string, Archetype> = {

  // ── Gaming ──────────────────────────────────────────────────────────────────
  gaming_hype: {
    label: "High-Energy Gamer",
    tagline: "The reaction is the content.",
    description: "Your clips land because viewers feel the moment when you lose it. That energy gap — calm gameplay into a sudden explosion — is what makes the reaction hit. Keep the energy up in downtime too, because the contrast is what sells the peak.",
    color: "text-purple-400", border: "border-purple-500/20",
  },
  gaming_funny: {
    label: "Comedy Gamer",
    tagline: "You make the game funny.",
    description: "Your funniest moments happen inside the game naturally — that's rare and hard to fake. Comedy clips spread faster than any other category because people tag their friends. Double down on your natural reactions and stop filtering yourself.",
    color: "text-yellow-400", border: "border-yellow-500/20",
  },
  gaming_educational: {
    label: "Strategist",
    tagline: "You think out loud and it becomes content.",
    description: "Viewers watch you to understand how to play better, not just to be entertained. Your decision-making commentary — even when you're wrong — is the product. Clip your sharpest reads and breakdowns as short tips. That content converts to followers.",
    color: "text-blue-400", border: "border-blue-500/20",
  },
  gaming_emotional: {
    label: "Clutch Performer",
    tagline: "High-stakes moments, real reactions.",
    description: "Emotional peaks during gameplay are almost impossible to fake and impossible to copy. Your streams have real pressure and real responses to it. Lean into harder content, higher stakes, and narrate what you're feeling when it matters most.",
    color: "text-red-400", border: "border-red-500/20",
  },

  // ── Just Chatting ───────────────────────────────────────────────────────────
  just_chatting_funny: {
    label: "Chat Comedian",
    tagline: "Chat sets you up, you knock it down.",
    description: "Your funniest moments come from the back-and-forth with chat — that dynamic is your biggest growth driver. Build regulars, remember names, and let chat escalate the bit. The more invested chat is, the funnier you get.",
    color: "text-yellow-400", border: "border-yellow-500/20",
  },
  just_chatting_emotional: {
    label: "Parasocial Builder",
    tagline: "Viewers feel like they know you.",
    description: "Genuine personal moments are your strongest content — the kind that makes a viewer feel like they were there. Don't filter yourself. Real stories, honest reactions, and moments of vulnerability build the kind of loyalty that doesn't leave.",
    color: "text-red-400", border: "border-red-500/20",
  },
  just_chatting_hype: {
    label: "Hype Host",
    tagline: "You build energy out of nothing.",
    description: "Creating momentum in a conversation-only stream is a rare skill. Use it intentionally — structured segments, games with chat, and high-energy callbacks keep the crowd in it. Your peaks are events, not accidents.",
    color: "text-purple-400", border: "border-purple-500/20",
  },
  just_chatting_educational: {
    label: "Knowledge Streamer",
    tagline: "You teach through conversation.",
    description: "Your insights land because they feel like a real conversation, not a lecture. That's a hard format to pull off. Clip your clearest takes — opinion-driven, direct, and short. That content earns subscribers on YouTube Shorts faster than gameplay ever will.",
    color: "text-blue-400", border: "border-blue-500/20",
  },

  // ── IRL ─────────────────────────────────────────────────────────────────────
  irl_hype: {
    label: "IRL Entertainer",
    tagline: "Every stream is an event.",
    description: "You turn real-world situations into high-energy content. The location is a prop, the strangers are cast members, and you're always on. Clip the unexpected moments — those are what drive people to follow and come back.",
    color: "text-purple-400", border: "border-purple-500/20",
  },
  irl_funny: {
    label: "IRL Comedian",
    tagline: "Real life gives you the material.",
    description: "Your funniest moments happen in the real world and they can't be scripted. That authenticity is the whole point. Clip encounters and reactions as they happen — unedited, unfiltered. People share them because they feel real.",
    color: "text-yellow-400", border: "border-yellow-500/20",
  },
  irl_emotional: {
    label: "Storyteller",
    tagline: "The world is your content.",
    description: "Your emotional peaks feel authentic because they come from real moments — conversations, places, unexpected experiences. Let the environment surprise you. Narrate what you're thinking in real time, and let viewers feel like they're living it with you.",
    color: "text-red-400", border: "border-red-500/20",
  },
  irl_educational: {
    label: "Explorer",
    tagline: "You show people things they've never seen.",
    description: "Your value is access — to places, experiences, or perspectives most viewers will never have. Treat every stream like a documentary. The more you explain what's happening around you, the more invested the audience becomes.",
    color: "text-blue-400", border: "border-blue-500/20",
  },

  // ── Variety ─────────────────────────────────────────────────────────────────
  variety_hype: {
    label: "Entertainment Machine",
    tagline: "High energy across everything.",
    description: "You keep the energy up regardless of what's on screen — that's your brand, not the game. Make sure new viewers can identify who you are within 30 seconds of landing on stream. Your personality is the constant, not the content.",
    color: "text-purple-400", border: "border-purple-500/20",
  },
  variety_funny: {
    label: "All-Around Entertainer",
    tagline: "Any game, same energy.",
    description: "You're watchable across everything because the humor is yours, not the game's. That's a growth advantage — you're never locked into a dead game's audience. Lean into the variety. More games means more clip surfaces and more discovery.",
    color: "text-yellow-400", border: "border-yellow-500/20",
  },
  variety_emotional: {
    label: "Variety Personality",
    tagline: "It's about you, not the game.",
    description: "Viewers follow variety streamers because of who they are, not what they're playing. Your emotional peaks prove you're building a real connection. Make your personality recognizable across every game — that's what makes followers stick.",
    color: "text-red-400", border: "border-red-500/20",
  },
  variety_educational: {
    label: "Versatile Analyst",
    tagline: "You find depth in everything you play.",
    description: "You bring insight to every game you touch — strategy, observation, and opinion. That's a unique angle for a variety streamer. Clip your best reads and takes as short-form tips. Cross-game insight content finds audiences that never watched the stream.",
    color: "text-blue-400", border: "border-blue-500/20",
  },

  // ── Educational ─────────────────────────────────────────────────────────────
  educational_educational: {
    label: "The Educator",
    tagline: "You make people better.",
    description: "Your value is clear and repeatable — viewers come for the knowledge and stay for the clarity. Clip your sharpest insights as standalone shorts. Educational clips on YouTube Shorts and TikTok have some of the highest follow-through rates of any content type.",
    color: "text-blue-400", border: "border-blue-500/20",
  },
  educational_hype: {
    label: "Engaging Teacher",
    tagline: "You make learning feel exciting.",
    description: "You bring energy to content that most creators deliver dry. That's a real differentiator — viewers get the knowledge and the entertainment. Clip the moments where the hype and the insight land at the same time. That's your most shareable content.",
    color: "text-purple-400", border: "border-purple-500/20",
  },
  educational_funny: {
    label: "Edutainer",
    tagline: "Smart and funny is the hardest combination to pull off.",
    description: "You teach through humor and that's rare. The comedy makes the knowledge stick. Clip your funniest explanations — they spread in communities that would never watch a straight educational stream but will share a funny clip that taught them something.",
    color: "text-yellow-400", border: "border-yellow-500/20",
  },
  educational_emotional: {
    label: "Passionate Expert",
    tagline: "Your care for the subject is the content.",
    description: "Emotional peaks during educational streams come from genuine passion — viewers can tell the difference between someone teaching a topic and someone who lives it. Let that care show. Authenticity in educational content builds the deepest trust.",
    color: "text-red-400", border: "border-red-500/20",
  },
};

// Fallbacks when we have stream type but no peak match, or vice versa
const PEAK_FALLBACKS: Record<string, Omit<Archetype, "border">> = {
  hype:        { label: "Hype Creator",      tagline: "You bring the energy.",           description: "Electric reactions and high-energy moments are your growth engine. Clip them constantly.",                             color: "text-purple-400" },
  funny:       { label: "Comedy Streamer",   tagline: "You make people laugh.",           description: "Comedy clips spread fast — people tag their friends. Your natural humor is your biggest growth tool.",                color: "text-yellow-400" },
  educational: { label: "Knowledge Creator", tagline: "You teach while you stream.",      description: "Clip your clearest insights as standalone shorts. Educational content converts to followers faster than gameplay.",    color: "text-blue-400"   },
  emotional:   { label: "Story-Driven Creator", tagline: "You make people feel something.", description: "Genuine emotional moments build the deepest loyalty. Viewers become fans because of how you made them feel.",       color: "text-red-400"    },
};

const CATEGORY_COLORS: Record<string, string> = {
  hype: "bg-purple-500",
  funny: "bg-yellow-400",
  educational: "bg-blue-400",
  emotional: "bg-red-400",
};

const CATEGORY_GLOW: Record<string, { text: string; shadow: string; border: string; bg: string }> = {
  hype:        { text: "text-purple-300", shadow: "0 0 20px rgba(168,85,247,0.5), 0 0 40px rgba(168,85,247,0.2)", border: "border-purple-500/40", bg: "bg-purple-500/10" },
  funny:       { text: "text-yellow-300", shadow: "0 0 20px rgba(250,204,21,0.5), 0 0 40px rgba(250,204,21,0.2)",  border: "border-yellow-500/40", bg: "bg-yellow-500/10" },
  educational: { text: "text-blue-300",   shadow: "0 0 20px rgba(59,130,246,0.5), 0 0 40px rgba(59,130,246,0.2)",   border: "border-blue-500/40",   bg: "bg-blue-500/10" },
  emotional:   { text: "text-red-300",    shadow: "0 0 20px rgba(239,68,68,0.5), 0 0 40px rgba(239,68,68,0.2)",     border: "border-red-500/40",    bg: "bg-red-500/10" },
};

const CATEGORY_LABELS: Record<string, string> = {
  hype: "Hype",
  funny: "Comedy",
  educational: "Educational",
  emotional: "Emotional",
};

const STREAMER_TYPE_LABELS: Record<string, string> = {
  gaming: "Gaming",
  just_chatting: "Just Chatting",
  irl: "IRL",
  variety: "Variety",
  educational: "Educational",
};

interface Props {
  dominantCategory: string | null;
  dominantStreamerType: string | null;
  categoryCounts: Record<string, number>;
  totalPeaks: number;
  compact?: boolean;
}

export function ArchetypeCard({ dominantCategory, dominantStreamerType, categoryCounts, totalPeaks, compact }: Props) {
  const key = dominantStreamerType && dominantCategory
    ? `${dominantStreamerType}_${dominantCategory}`
    : null;

  const archetype = key && ARCHETYPES[key]
    ? ARCHETYPES[key]
    : dominantCategory && PEAK_FALLBACKS[dominantCategory]
    ? { ...PEAK_FALLBACKS[dominantCategory], border: "border-white/10" }
    : null;

  if (compact) {
    return (
      <div className={`bg-surface border rounded-2xl px-5 py-4 ${archetype?.border || "border-border"}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
              archetype?.color === "text-purple-400" ? "bg-purple-400"
              : archetype?.color === "text-yellow-400" ? "bg-yellow-400"
              : archetype?.color === "text-blue-400" ? "bg-blue-400"
              : archetype?.color === "text-red-400" ? "bg-red-400"
              : "bg-white/30"
            }`} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted font-medium flex-shrink-0">Your Archetype</p>
                {dominantStreamerType && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/40 flex-shrink-0">
                    {STREAMER_TYPE_LABELS[dominantStreamerType] ?? dominantStreamerType}
                  </span>
                )}
              </div>
              <p className={`text-sm font-extrabold mt-0.5 ${archetype?.color || "text-white"}`}>
                {archetype?.label || "Analyzing..."} <span className="text-white/40 font-normal">· {archetype?.tagline}</span>
              </p>
            </div>
          </div>
          {/* Compact breakdown pills */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {Object.entries(categoryCounts)
              .filter(([, count]) => count > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([cat], i) => {
                const glow = CATEGORY_GLOW[cat];
                const isDominant = i === 0;
                return (
                  <span
                    key={cat}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      isDominant && glow
                        ? `${glow.bg} ${glow.border} ${glow.text}`
                        : "bg-white/[0.03] border-white/[0.06] text-white/30"
                    }`}
                    style={isDominant && glow ? { boxShadow: glow.shadow } : undefined}
                  >
                    {CATEGORY_LABELS[cat]}
                  </span>
                );
              })}
          </div>
        </div>
      </div>
    );
  }

  // Hex for archetype color
  const archetypeHex =
    archetype?.color === "text-purple-400" ? "#a855f7"
    : archetype?.color === "text-yellow-400" ? "#facc15"
    : archetype?.color === "text-blue-400" ? "#3b82f6"
    : archetype?.color === "text-red-400" ? "#ef4444"
    : archetype?.color === "text-emerald-400" ? "#10b981"
    : archetype?.color === "text-orange-400" ? "#f97316"
    : archetype?.color === "text-cyan-400" ? "#06b6d4"
    : archetype?.color === "text-pink-400" ? "#ec4899"
    : archetype?.color === "text-violet-400" ? "#8b5cf6"
    : "#8b5cf6";

  return (
    <div
      className="rounded-2xl relative overflow-hidden"
      style={{
        background: `radial-gradient(ellipse 70% 60% at 0% 0%, ${archetypeHex}18 0%, rgba(10,9,20,0) 65%), rgba(10,9,20,0.98)`,
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <div className="absolute top-0 left-0 w-40 h-px" style={{ background: `linear-gradient(90deg, ${archetypeHex}80, transparent)` }} />

      <div className="flex flex-col lg:flex-row lg:items-start gap-8 px-6 py-7">
        {/* Left — archetype identity */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <p className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: archetypeHex }}>Your Streamer Archetype</p>
            {dominantStreamerType && (
              <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-white/45">
                {STREAMER_TYPE_LABELS[dominantStreamerType] ?? dominantStreamerType}
              </span>
            )}
          </div>
          <h2 className={`text-3xl sm:text-4xl font-black tracking-tight leading-none mb-2 ${archetype?.color || "text-white"}`}>
            {archetype?.label || "Analyzing..."}
          </h2>
          <p className="text-base text-white/70 font-medium mb-3 italic">{archetype?.tagline}</p>
          <p className="text-sm text-white/55 leading-relaxed max-w-xl">{archetype?.description}</p>
        </div>

        {/* Right — breakdown as glowing pills */}
        <div className="lg:w-64 flex-shrink-0">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-white/40 mb-4">Your content mix</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(categoryCounts)
              .filter(([, count]) => count > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, count], i) => {
                const pct = Math.round((count / totalPeaks) * 100);
                const glow = CATEGORY_GLOW[cat];
                const isDominant = i === 0;
                return (
                  <div
                    key={cat}
                    className={`px-3.5 py-2 rounded-xl border transition-all ${
                      isDominant && glow
                        ? `${glow.bg} ${glow.border} ${glow.text}`
                        : "bg-white/[0.025] border-white/[0.06]"
                    }`}
                    style={isDominant && glow ? { boxShadow: glow.shadow } : undefined}
                  >
                    <span className={`text-sm font-bold ${isDominant && glow ? glow.text : "text-white/55"}`}>
                      {CATEGORY_LABELS[cat]}
                    </span>
                    <span className={`text-xs font-bold tabular-nums ml-1.5 ${isDominant ? "text-white/55" : "text-white/25"}`}>
                      {pct}%
                    </span>
                  </div>
                );
              })}
          </div>
          <p className="text-[10px] text-white/30 mt-3 font-medium">{totalPeaks} clip moments across all streams</p>
        </div>
      </div>
    </div>
  );
}
