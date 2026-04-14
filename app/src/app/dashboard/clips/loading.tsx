export default function Loading() {
  return (
    <div>
      <div className="mb-8">
        <div className="h-3 w-20 bg-white/5 rounded-full mb-3 animate-pulse" />
        <div className="h-8 w-14 bg-white/[0.08] rounded-lg mb-2 animate-pulse" />
        <div className="h-3 w-52 bg-white/5 rounded-full animate-pulse" />
      </div>

      <div className="h-4 w-36 bg-white/[0.06] rounded-full mb-4 animate-pulse" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-surface border border-border rounded-2xl overflow-hidden">
            <div className="w-full aspect-video bg-white/[0.04] animate-pulse" />
            <div className="p-4 space-y-3">
              <div className="flex justify-between gap-3">
                <div className="h-4 bg-white/[0.06] rounded-full animate-pulse flex-1" />
                <div className="h-4 w-8 bg-white/5 rounded-full animate-pulse" />
              </div>
              <div className="flex gap-2">
                <div className="h-5 w-14 bg-white/5 rounded-full animate-pulse" />
                <div className="h-5 w-10 bg-white/5 rounded-full animate-pulse" />
              </div>
              <div className="h-14 bg-white/[0.03] rounded-lg animate-pulse" />
              <div className="flex gap-4 pt-1">
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="h-4 w-16 bg-white/5 rounded-full animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
