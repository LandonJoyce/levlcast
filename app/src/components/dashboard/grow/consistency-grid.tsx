"use client";

const DAYS = 28;

function getLast28Days(): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export function ConsistencyGrid({ streamDates }: { streamDates: Set<string> }) {
  const days = getLast28Days();

  // Calculate streak (from today backwards)
  let streak = 0;
  const today = new Date().toISOString().slice(0, 10);
  for (let i = 0; i < DAYS; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (streamDates.has(key)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  const streamed = days.filter((d) => streamDates.has(d)).length;
  const frequency = streamed >= 20 ? "Daily" : streamed >= 12 ? "3-4x/week" : streamed >= 6 ? "1-2x/week" : "Occasional";
  const frequencyColor = streamed >= 20 ? "text-green-400" : streamed >= 12 ? "text-yellow-400" : "text-red-400";

  // Tip based on frequency
  const tip = streamed >= 20
    ? "You're streaming consistently — the algorithm loves you."
    : streamed >= 12
    ? "Good pace. Aim for 5+ days/week to hit the sweet spot for Twitch's algorithm."
    : streamed >= 6
    ? "Try to stream at least every other day. Consistency is the biggest factor for algorithmic growth."
    : "Viewers can't find you if you're not live. Even 3x/week makes a big difference.";

  return (
    <div className="bg-surface border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-muted mb-0.5">Stream Consistency</h2>
          <p className="text-xs text-muted">Last 28 days</p>
        </div>
        <div className="text-right">
          <p className={`text-lg font-extrabold ${frequencyColor}`}>{frequency}</p>
          {streak > 1 && (
            <p className="text-xs text-muted">{streak}-day streak 🔥</p>
          )}
        </div>
      </div>

      {/* Dot grid — 4 rows of 7 */}
      <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(14, 1fr)" }}>
        {days.map((day) => {
          const streamed = streamDates.has(day);
          const isToday = day === today;
          return (
            <div
              key={day}
              title={day}
              className={`aspect-square rounded-sm transition-all ${
                streamed
                  ? "bg-accent"
                  : "bg-white/[0.05]"
              } ${isToday ? "ring-1 ring-accent-light" : ""}`}
            />
          );
        })}
      </div>

      <div className="flex items-center gap-3 mt-3 mb-4">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-accent" />
          <span className="text-xs text-muted">Streamed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-white/[0.05]" />
          <span className="text-xs text-muted">No stream</span>
        </div>
        <span className="text-xs text-muted ml-auto">{streamed} of 28 days</span>
      </div>

      <div className={`p-3 rounded-xl text-xs leading-relaxed ${
        streamed >= 20 ? "bg-green-500/10 border border-green-500/20 text-green-300"
        : streamed >= 12 ? "bg-yellow-500/10 border border-yellow-500/20 text-yellow-300"
        : "bg-red-500/10 border border-red-500/20 text-red-300"
      }`}>
        {tip}
      </div>
    </div>
  );
}
