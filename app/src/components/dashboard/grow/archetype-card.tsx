"use client";

const ARCHETYPES: Record<string, {
  label: string;
  tagline: string;
  description: string;
  color: string;
  bg: string;
  border: string;
  bar: string;
  emoji: string;
}> = {
  hype: {
    label: "Hype Creator",
    tagline: "You bring the energy.",
    description: "Your best moments are electric — big plays, hype reactions, and crowd-fired moments. Viewers come for the rush. Clip these and post them constantly.",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    bar: "bg-purple-500",
    emoji: "⚡",
  },
  funny: {
    label: "Comedy Streamer",
    tagline: "You make people laugh.",
    description: "Your funniest moments are your best growth tool. Comedy clips spread fast — people tag their friends. Double down on your natural humor every stream.",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/20",
    bar: "bg-yellow-400",
    emoji: "😂",
  },
  educational: {
    label: "Educational Creator",
    tagline: "You teach while you play.",
    description: "Viewers trust you for knowledge. Tips, breakdowns, and strategy moments are your viral content. Clip your best insights and post them as quick tutorials.",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    bar: "bg-blue-400",
    emoji: "🧠",
  },
  emotional: {
    label: "Story-Driven Streamer",
    tagline: "You make people feel something.",
    description: "Your emotional peaks build the deepest loyalty. Wholesome moments, comebacks, and personal stories make viewers stick around for months.",
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    bar: "bg-red-400",
    emoji: "❤️",
  },
};

const CATEGORY_COLORS: Record<string, string> = {
  hype: "bg-purple-500",
  funny: "bg-yellow-400",
  educational: "bg-blue-400",
  emotional: "bg-red-400",
};

const CATEGORY_LABELS: Record<string, string> = {
  hype: "Hype",
  funny: "Funny",
  educational: "Educational",
  emotional: "Emotional",
};

interface Props {
  dominantCategory: string | null;
  categoryCounts: Record<string, number>;
  totalPeaks: number;
}

export function ArchetypeCard({ dominantCategory, categoryCounts, totalPeaks }: Props) {
  const archetype = dominantCategory ? ARCHETYPES[dominantCategory] : null;

  return (
    <div className={`rounded-2xl border p-6 ${archetype ? archetype.border : "border-border"} ${archetype ? archetype.bg : "bg-surface"}`}>
      <div className="flex items-start gap-4 mb-5">
        {archetype && (
          <div className="text-4xl flex-shrink-0">{archetype.emoji}</div>
        )}
        <div>
          <p className="text-xs text-muted uppercase tracking-wide font-semibold mb-1">Your Content Archetype</p>
          <h2 className={`text-2xl font-extrabold ${archetype?.color || "text-white"}`}>
            {archetype?.label || "Unknown"}
          </h2>
          <p className="text-sm text-white/70 mt-1">{archetype?.tagline}</p>
        </div>
      </div>

      <p className="text-sm text-white/60 leading-relaxed mb-5">
        {archetype?.description}
      </p>

      {/* Category breakdown bar */}
      <div>
        <p className="text-xs text-muted mb-2 font-medium">Peak breakdown across all your streams</p>
        {/* Stacked bar */}
        <div className="flex rounded-full overflow-hidden h-3 w-full gap-px">
          {Object.entries(categoryCounts)
            .filter(([, count]) => count > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, count]) => (
              <div
                key={cat}
                className={`${CATEGORY_COLORS[cat]} transition-all`}
                style={{ width: `${(count / totalPeaks) * 100}%` }}
                title={`${CATEGORY_LABELS[cat]}: ${count} peaks`}
              />
            ))}
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
          {Object.entries(categoryCounts)
            .filter(([, count]) => count > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, count]) => (
              <div key={cat} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${CATEGORY_COLORS[cat]}`} />
                <span className="text-xs text-muted">
                  {CATEGORY_LABELS[cat]} <span className="text-white/50">{Math.round((count / totalPeaks) * 100)}%</span>
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
