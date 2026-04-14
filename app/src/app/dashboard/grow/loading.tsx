export default function Loading() {
  return (
    <div>
      <div className="mb-8">
        <div className="h-3 w-24 bg-white/5 rounded-full mb-3 animate-pulse" />
        <div className="h-8 w-36 bg-white/[0.08] rounded-lg mb-2 animate-pulse" />
        <div className="h-3 w-64 bg-white/5 rounded-full animate-pulse" />
      </div>

      {/* Momentum strip */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-surface border border-border rounded-2xl px-5 py-5 space-y-3">
            <div className="h-2.5 w-20 bg-white/5 rounded-full animate-pulse" />
            <div className="h-10 w-16 bg-white/[0.08] rounded-xl animate-pulse" />
            <div className="h-2.5 w-28 bg-white/5 rounded-full animate-pulse" />
          </div>
        ))}
      </div>

      {/* Tactics carousel */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden mb-5">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="space-y-1.5">
            <div className="h-4 w-44 bg-white/[0.06] rounded-full animate-pulse" />
            <div className="h-3 w-36 bg-white/5 rounded-full animate-pulse" />
          </div>
          <div className="flex gap-2">
            <div className="h-7 w-7 bg-white/5 rounded-lg animate-pulse" />
            <div className="h-7 w-7 bg-white/5 rounded-lg animate-pulse" />
          </div>
        </div>
        <div className="p-5 space-y-3">
          <div className="h-5 w-28 bg-white/5 rounded-full animate-pulse" />
          <div className="h-5 w-3/4 bg-white/[0.06] rounded-full animate-pulse" />
          <div className="space-y-2">
            <div className="h-3 bg-white/5 rounded-full animate-pulse" />
            <div className="h-3 bg-white/5 rounded-full animate-pulse" />
            <div className="h-3 w-2/3 bg-white/5 rounded-full animate-pulse" />
          </div>
          <div className="h-16 bg-white/[0.03] rounded-xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}
