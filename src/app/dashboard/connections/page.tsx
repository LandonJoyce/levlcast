import { Link2 } from "lucide-react";

/** Connections page — placeholder until Phase 5 */
export default function ConnectionsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight mb-1">
          Connections
        </h1>
        <p className="text-sm text-muted">
          Connect your social accounts for auto-posting.
        </p>
      </div>
      <div className="bg-surface border border-border rounded-2xl p-12 text-center">
        <Link2 size={32} className="text-muted mx-auto mb-4" />
        <h2 className="text-lg font-bold mb-2">Coming in Phase 5</h2>
        <p className="text-sm text-muted max-w-md mx-auto">
          YouTube, TikTok, and Instagram connections will be available here.
        </p>
      </div>
    </div>
  );
}
