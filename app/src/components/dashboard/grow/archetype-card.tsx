"use client";

const ARCHETYPES: Record<string, {
  label: string;
  tagline: string;
  description: string;
  color: string;
  border: string;
}> = {
  hype: {
    label: "Hype Creator",
    tagline: "You bring the energy.",
    description: "Your best moments are electric — big plays, hype reactions, crowd-fired moments. Viewers come for the rush. Clip these constantly and stream with that same intensity every time.",
    color: "text-purple-400",
    border: "border-purple-500/20",
  },
  funny: {
    label: "Comedy Streamer",
    tagline: "You make people laugh.",
    description: "Your funniest moments are your best growth tool. Comedy clips spread fast — people tag their friends. Double down on your natural humor every stream, don't hold back.",
    color: "text-yellow-400",
    border: "border-yellow-500/20",
  },
  educational: {
    label: "Educational Creator",
    tagline: "You teach while you play.",
    description: "Viewers trust you for knowledge. Tips, breakdowns, and strategy moments are your viral content. Clip your best insights and post them as quick tutorials.",
    color: "text-blue-400",
    border: "border-blue-500/20",
  },
  emotional: {
    label: "Story-Driven Streamer",
    tagline: "You make people feel something.",
    description: "Your emotional peaks build the deepest loyalty. Wholesome moments, comebacks, and personal stories make viewers stick around for months and become real fans.",
    color: "text-red-400",
    border: "border-red-500/20",
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
    <div className={`bg-surface border rounded-2xl p-6 ${archetype?.border || "border-border"}`}>
      <div className="flex flex-col lg:flex-row lg:items-start gap-6">
        {/* Left — archetype identity */}
        <div className="flex-1">
          <p className="text-xs text-muted uppercase tracking-wide font-semibold mb-2">Your Content Archetype</p>
          <h2 className={`text-3xl font-extrabold mb-1 ${archetype?.color || "text-white"}`}>
            {archetype?.label || "Unknown"}
          </h2>
          <p className="text-sm text-white/60 mb-3">{archetype?.tagline}</p>
          <p className="text-sm text-white/50 leading-relaxed max-w-xl">{archetype?.description}</p>
        </div>

        {/* Right — breakdown */}
        <div className="lg:w-72 flex-shrink-0">
          <p className="text-xs text-muted font-medium mb-3">Peak breakdown across all streams</p>
          <div className="flex rounded-lg overflow-hidden h-4 w-full gap-px mb-4">
            {Object.entries(categoryCounts)
              .filter(([, count]) => count > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, count]) => (
                <div
                  key={cat}
                  className={`${CATEGORY_COLORS[cat]}`}
                  style={{ width: `${(count / totalPeaks) * 100}%` }}
                  title={`${CATEGORY_LABELS[cat]}: ${count}`}
                />
              ))}
          </div>
          <div className="space-y-2">
            {Object.entries(categoryCounts)
              .filter(([, count]) => count > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, count]) => (
                <div key={cat} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-sm ${CATEGORY_COLORS[cat]}`} />
                    <span className="text-xs text-white/70">{CATEGORY_LABELS[cat]}</span>
                  </div>
                  <span className="text-xs text-muted">{count} peaks · {Math.round((count / totalPeaks) * 100)}%</span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
