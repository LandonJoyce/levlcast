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

  const pulseHex = streamed >= 20 ? "#4ade80" : streamed >= 12 ? "#facc15" : "#8b5cf6";

  return (
    <div
      className="rounded-2xl relative overflow-hidden h-full"
      style={{ background: "rgba(10,9,20,0.98)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="absolute top-0 left-0 w-24 h-px" style={{ background: `linear-gradient(90deg, ${pulseHex}60, transparent)` }} />

      <div className="px-6 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-violet-400 mb-0.5">Stream Cadence</p>
            <h2 className="text-sm font-bold text-white">Consistency drives growth.</h2>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-3xl font-black tabular-nums leading-none text-white">
              {streamed}<span className="text-sm font-bold text-white/25 ml-1">/ 28</span>
            </p>
            {streak > 1 && (
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-orange-400 mt-1">{streak}-day streak</p>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 py-5">
        {/* Calendar grid */}
        <div className="flex gap-3 mb-4">
          <div className="flex flex-col gap-1.5 pt-0.5">
            {DAY_LABELS.map((label, i) => (
              <div key={i} className="h-4 flex items-center">
                <span className="text-[10px] text-white/25 w-3 font-semibold">{label}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-1.5 flex-1">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1.5 flex-1">
                {week.map((day) => {
                  const didStream = streamDates.has(day);
                  const isToday = day === today;
                  return (
                    <div
                      key={day}
                      title={`${new Date(day).toLocaleDateString("en-US", { month: "short", day: "numeric" })}${didStream ? ": streamed" : ""}` }
                      className={`h-4 rounded-[3px] transition-all ${didStream ? "" : "bg-white/[0.04]"} ${isToday ? "ring-1 ring-violet-400/60" : ""}`}
                      style={didStream ? { background: `linear-gradient(135deg, ${pulseHex}, ${pulseHex}cc)`, boxShadow: `0 0 6px ${pulseHex}55` } : undefined}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-[2px]" style={{ background: pulseHex }} />
            <span className="text-[10px] text-white/40 font-semibold">Streamed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-[2px] bg-white/[0.04]" />
            <span className="text-[10px] text-white/40 font-semibold">Off</span>
          </div>
        </div>

        {/* Tip */}
        {streamed > 0 && (
          <div
            className="p-3.5 rounded-xl text-xs leading-relaxed relative overflow-hidden"
            style={{
              background: streamed >= 20
                ? "linear-gradient(135deg, rgba(74,222,128,0.12) 0%, rgba(22,163,74,0.04) 60%, rgba(10,9,20,0) 100%)"
                : streamed >= 12
                ? "linear-gradient(135deg, rgba(250,204,21,0.1) 0%, rgba(202,138,4,0.04) 60%, rgba(10,9,20,0) 100%)"
                : "rgba(255,255,255,0.02)",
              border: streamed >= 20
                ? "1px solid rgba(74,222,128,0.22)"
                : streamed >= 12
                ? "1px solid rgba(250,204,21,0.22)"
                : "1px solid rgba(255,255,255,0.06)",
              color: streamed >= 20 ? "#86efac" : streamed >= 12 ? "#fde68a" : "rgba(255,255,255,0.55)",
            }}
          >
            {streamed >= 20
              ? "Streaming consistently. The algorithm loves you."
              : streamed >= 12
              ? "Good pace. Push for 5+ days/week to hit the sweet spot."
              : "Consistency is the biggest factor for growth. Even 3x/week makes a big difference."}
          </div>
        )}
      </div>
    </div>
  );
}
