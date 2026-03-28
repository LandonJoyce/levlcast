import { createClient } from "@/lib/supabase/server";
import { Youtube, CheckCircle, AlertCircle } from "lucide-react";
import Link from "next/link";

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const params = await searchParams;

  const { data: connections } = await supabase
    .from("social_connections")
    .select("platform, updated_at")
    .eq("user_id", user!.id);

  const isYouTubeConnected = connections?.some((c) => c.platform === "youtube");

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight mb-1">Connections</h1>
        <p className="text-sm text-muted">Connect your social accounts to auto-post clips.</p>
      </div>

      {params.success === "youtube" && (
        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 text-sm px-4 py-3 rounded-xl mb-6">
          <CheckCircle size={16} />
          YouTube connected successfully!
        </div>
      )}

      {params.error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl mb-6">
          <AlertCircle size={16} />
          {params.error === "oauth_failed" ? "Connection failed. Please try again." : "Something went wrong."}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* YouTube */}
        <div className="bg-surface border border-border rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <Youtube size={20} className="text-red-400" />
            </div>
            <div>
              <h2 className="font-bold">YouTube</h2>
              <p className="text-xs text-muted">Upload clips as YouTube Shorts</p>
            </div>
            {isYouTubeConnected && (
              <span className="ml-auto text-xs font-semibold text-green-400 bg-green-500/10 px-2 py-1 rounded-full">Connected</span>
            )}
          </div>
          <Link
            href="/api/auth/youtube"
            className="block w-full text-center bg-red-500 hover:opacity-85 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-opacity"
          >
            {isYouTubeConnected ? "Reconnect YouTube" : "Connect YouTube"}
          </Link>
        </div>

        {/* TikTok — coming soon */}
        <div className="bg-surface border border-border rounded-2xl p-6 opacity-60">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
              <span className="text-lg">🎵</span>
            </div>
            <div>
              <h2 className="font-bold">TikTok</h2>
              <p className="text-xs text-muted">Auto-post clips to TikTok</p>
            </div>
            <span className="ml-auto text-xs font-semibold text-muted bg-white/5 px-2 py-1 rounded-full">Coming Soon</span>
          </div>
          <button disabled className="block w-full text-center bg-white/5 text-muted font-semibold px-4 py-2.5 rounded-xl text-sm cursor-not-allowed">
            Connect TikTok
          </button>
        </div>
      </div>
    </div>
  );
}
