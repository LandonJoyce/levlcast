import { createClient } from "@/lib/supabase/server";
import { Youtube, CheckCircle, AlertCircle } from "lucide-react";

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
  const isTikTokConnected = connections?.some((c) => c.platform === "tiktok");

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight mb-1">Connections</h1>
        <p className="text-sm text-muted">Connect your social accounts to auto-post clips.</p>
      </div>

      {(params.success === "youtube" || params.success === "tiktok") && (
        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 text-sm px-4 py-3 rounded-xl mb-6">
          <CheckCircle size={16} />
          {params.success === "tiktok" ? "TikTok connected successfully!" : "YouTube connected successfully!"}
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
          <a
            href="/api/auth/youtube"
            className="block w-full text-center bg-red-500 hover:opacity-85 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-opacity"
          >
            {isYouTubeConnected ? "Reconnect YouTube" : "Connect YouTube"}
          </a>
        </div>

        {/* TikTok */}
        <div className="bg-surface border border-border rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z"/></svg>
            </div>
            <div>
              <h2 className="font-bold">TikTok</h2>
              <p className="text-xs text-muted">Auto-post clips to TikTok</p>
            </div>
            {isTikTokConnected && (
              <span className="ml-auto text-xs font-semibold text-green-400 bg-green-500/10 px-2 py-1 rounded-full">Connected</span>
            )}
          </div>
          <a
            href="/api/auth/tiktok"
            className="block w-full text-center bg-white/10 hover:bg-white/15 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors"
          >
            {isTikTokConnected ? "Reconnect TikTok" : "Connect TikTok"}
          </a>
        </div>
      </div>
    </div>
  );
}
