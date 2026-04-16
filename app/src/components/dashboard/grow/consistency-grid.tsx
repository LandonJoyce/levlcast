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

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export function ConsistencyGrid({ streamDates }: { streamDates: Set<string> }) {
  const days = getLast28Days();
  const today = new Date().toISOString().slice(0, 10);

  // Calculate streak (from today backwards)
  let streak = 0;
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

  // Group days into weeks (columns) for a calendar-style grid
  // Each column = 7 days, 4 columns for 28 days
  const weeks: string[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <div className="bg-surface border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-white mb-0.5">Stream Consistency</h2>
          <p className="text-xs text-muted">Last 28 days</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-extrabold text-white">{streamed}<span className="text-sm font-medium text-muted ml-1">/ 28</span></p>
          {streak > 1 && (
            <p className="text-xs text-accent-light font-medium">{streak}-day streak</p>
          )}
        </div>
      </div>

      {/* Calendar grid — 4 weeks as columns, 7 days as rows */}
      <div className="flex gap-3">
        {/* Day labels */}
        <div className="flex flex-col gap-1.5 pt-0.5">
          {DAY_LABELS.map((label, i) => (
            <div key={i} className="h-4 flex items-center">
              <span className="text-[10px] text-muted/40 w-3">{label}</span>
            </div>
          ))}
        </div>

        {/* Week columns */}
        <div className="flex gap-1.5 flex-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1.5 flex-1">
              {week.map((day) => {
                const didStream = streamDates.has(day);
                const isToday = day === today;
                return (
                  <div
                    key={day}
                    title={`${new Date(day).toLocaleDateString("en-US", { month: "short", day: "numeric" })}${didStream ? " — streamed" : ""}`}
                    className={`h-4 rounded-[3px] transition-all ${
                      didStream
                        ? "bg-accent"
                        : "bg-white/[0.04]"
                    } ${isToday ? "ring-1 ring-accent-light/50" : ""}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-4 mt-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-[2px] bg-accent" />
          <span className="text-[10px] text-muted">Streamed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-[2px] bg-white/[0.04]" />
          <span className="text-[10px] text-muted">Off</span>
        </div>
      </div>

      {/* Tip — only show when there's enough data to be useful */}
      {streamed > 0 && (
        <div className={`mt-3 p-3 rounded-xl text-xs leading-relaxed ${
          streamed >= 20 ? "bg-green-500/10 border border-green-500/20 text-green-300"
          : streamed >= 12 ? "bg-yellow-500/10 border border-yellow-500/20 text-yellow-300"
          : "bg-white/[0.03] border border-white/[0.06] text-muted"
        }`}>
          {streamed >= 20
            ? "Streaming consistently — the algorithm loves you."
            : streamed >= 12
            ? "Good pace. Push for 5+ days/week to hit the sweet spot."
            : "Consistency is the biggest factor for growth. Even 3x/week makes a big difference."}
        </div>
      )}
    </div>
  );
}
