export default function Loading() {
  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="h-3 w-24 bg-white/5 rounded-full mb-3 animate-pulse" />
          <div className="h-8 w-14 bg-white/[0.08] rounded-lg mb-2 animate-pulse" />
          <div className="h-3 w-72 bg-white/5 rounded-full animate-pulse" />
        </div>
        <div className="h-10 w-28 bg-white/5 rounded-full animate-pulse" />
      </div>

      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[48px_2fr_120px_80px_80px_160px] gap-4 px-4 py-2.5 border-b border-border">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-2.5 bg-white/5 rounded-full animate-pulse" />
          ))}
        </div>
        <div className="divide-y divide-border">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="grid grid-cols-[48px_2fr_120px_80px_80px_160px] gap-4 px-4 py-3.5 items-center">
              <div className="w-12 aspect-video rounded bg-white/5 animate-pulse" />
              <div className="h-3 bg-white/[0.06] rounded-full animate-pulse" style={{ width: `${60 + (i * 13) % 35}%` }} />
              <div className="h-3 w-16 bg-white/5 rounded-full animate-pulse" />
              <div className="h-3 w-10 bg-white/5 rounded-full animate-pulse" />
              <div className="h-3 w-8 bg-white/5 rounded-full animate-pulse" />
              <div className="h-8 w-24 bg-white/5 rounded-full animate-pulse ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
