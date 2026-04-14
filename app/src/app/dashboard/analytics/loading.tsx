export default function Loading() {
  return (
    <div>
      <div className="mb-8">
        <div className="h-3 w-28 bg-white/5 rounded-full mb-3 animate-pulse" />
        <div className="h-8 w-24 bg-white/[0.08] rounded-lg mb-2 animate-pulse" />
        <div className="h-3 w-56 bg-white/5 rounded-full animate-pulse" />
      </div>

      {/* Score + Insights row */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 mb-6">
        <div className="p-px rounded-[22px] bg-white/5">
          <div className="bg-surface rounded-[21px] px-6 py-7 space-y-3">
            <div className="h-3 w-20 bg-white/5 rounded-full animate-pulse" />
            <div className="h-16 w-20 bg-white/[0.08] rounded-xl animate-pulse" />
            <div className="h-3 w-40 bg-white/5 rounded-full animate-pulse" />
          </div>
        </div>
        <div className="bg-surface border border-border rounded-2xl px-6 py-5">
          <div className="h-3 w-24 bg-white/5 rounded-full mb-5 animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 animate-pulse flex-shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-2.5 w-16 bg-white/5 rounded-full animate-pulse" />
                  <div className="h-3.5 bg-white/[0.06] rounded-full animate-pulse" style={{ width: `${55 + (i * 17) % 35}%` }} />
                  <div className="h-2.5 w-24 bg-white/5 rounded-full animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4 mb-6">
        <div className="bg-surface border border-border rounded-2xl p-6">
          <div className="h-4 w-48 bg-white/[0.06] rounded-full mb-4 animate-pulse" />
          <div className="h-28 bg-white/[0.03] rounded-xl animate-pulse" />
        </div>
        <div className="bg-surface border border-border rounded-2xl p-6">
          <div className="h-4 w-40 bg-white/[0.06] rounded-full mb-6 animate-pulse" />
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between">
                  <div className="h-3 w-16 bg-white/5 rounded-full animate-pulse" />
                  <div className="h-3 w-20 bg-white/5 rounded-full animate-pulse" />
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden animate-pulse">
                  <div className="h-full bg-white/10 rounded-full" style={{ width: `${30 + (i * 23) % 55}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
