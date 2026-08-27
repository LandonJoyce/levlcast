import { changelog, ChangeType } from "@/lib/changelog";
import { ChangelogSeen } from "./changelog-seen";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Patch Notes | LevlCast",
  description: "LevlCast patch notes: what's new, fixed, and improved.",
};

const TYPE_CONFIG: Record<ChangeType, { label: string; color: string; bg: string }> = {
  new:      { label: "NEW",      color: "text-green-400",  bg: "bg-green-400/10 border-green-400/20" },
  improved: { label: "IMPROVED", color: "text-blue-400",   bg: "bg-blue-400/10 border-blue-400/20" },
  fix:      { label: "FIX",      color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/20" },
  removed:  { label: "REMOVED",  color: "text-red-400",    bg: "bg-red-400/10 border-red-400/20" },
};

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-bg px-5 py-12">
      <ChangelogSeen />

      <div className="max-w-2xl mx-auto">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-white transition-colors mb-8"
        >
          <ArrowLeft size={14} />
          Back to dashboard
        </Link>

        <p className="text-xs font-bold tracking-widest uppercase text-accent-light mb-2">LevlCast</p>
        <h1 className="text-3xl font-extrabold tracking-tight mb-1">Patch Notes</h1>
        <p className="text-sm text-muted mb-12">Every update, ranked by what actually changed.</p>

        <div className="space-y-12">
          {changelog.map((entry, i) => (
            <div key={i}>
              {/* Version header */}
              <div className="flex items-baseline gap-3 mb-4 pb-3 border-b border-white/8">
                <span className="text-xl font-extrabold text-white tracking-tight">{entry.version}</span>
                <span className="text-sm font-semibold text-white/50">{entry.title}</span>
                <span className="ml-auto text-xs text-muted tabular-nums">
                  {new Date(entry.date + "T00:00:00").toLocaleDateString("en-US", {
                    month: "short", day: "numeric", year: "numeric",
                  })}
                </span>
                {i === 0 && (
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-accent/15 text-accent-light border border-accent/20">
                    Latest
                  </span>
                )}
              </div>

              {/* Change list */}
              <ul className="space-y-2.5">
                {entry.items.map((item, j) => {
                  const cfg = TYPE_CONFIG[item.type];
                  return (
                    <li key={j} className="flex items-start gap-3">
                      <span className={`flex-shrink-0 mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded border ${cfg.bg} ${cfg.color} tracking-wider`}>
                        {cfg.label}
                      </span>
                      <span className="text-sm text-white/70 leading-relaxed">{item.text}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
