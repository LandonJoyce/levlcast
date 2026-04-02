import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  detail?: string;
  accent?: boolean;
}

/**
 * Stat card — matches the analytics dashboard from levlcast.com.
 * Use `accent` prop for the highlighted purple variant.
 */
export function StatCard({ label, value, detail, accent }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl p-5 border transition-colors",
        accent
          ? "bg-accent/[0.08] border-accent/30"
          : "bg-surface border-border hover:border-white/10"
      )}
    >
      <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
        {label}
      </p>
      <p
        className={cn(
          "text-2xl font-extrabold tracking-tight",
          accent ? "text-accent-light" : "text-white"
        )}
      >
        {value}
      </p>
      {detail && <p className="text-xs text-muted mt-1">{detail}</p>}
    </div>
  );
}
