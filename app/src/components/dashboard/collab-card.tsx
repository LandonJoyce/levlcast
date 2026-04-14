"use client";

import { useEffect, useState } from "react";
import { Users, ExternalLink, X, MessageCircle, RefreshCw, Zap } from "lucide-react";

interface CollabSuggestion {
  id: string;
  match_user_id: string | null;
  match_score: number;
  reasons: string[];
  status: string;
  display_name: string;
  avatar_url: string | null;
  twitch_login: string | null;
  is_external: boolean;
  follower_count: number | null;
}

interface CollabProfile {
  enabled: boolean;
  tagline: string | null;
  preferred_categories: string[];
}

export function CollabCard() {
  const [profile, setProfile] = useState<CollabProfile | null>(null);
  const [suggestions, setSuggestions] = useState<CollabSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [optingIn, setOptingIn] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetch("/api/collab")
      .then((r) => r.json())
      .then((data) => {
        setProfile(data.profile);
        setSuggestions(data.suggestions || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch("/api/collab/refresh", { method: "POST" });
      const data = await fetch("/api/collab").then((r) => r.json());
      setSuggestions(data.suggestions || []);
    } catch {}
    setRefreshing(false);
  };

  const handleOptIn = async () => {
    setOptingIn(true);
    try {
      await fetch("/api/collab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true }),
      });
      setProfile({ enabled: true, tagline: null, preferred_categories: [] });
      await handleRefresh();
    } catch {}
    setOptingIn(false);
  };

  const handleDismiss = async (suggestionId: string) => {
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
    try {
      await fetch("/api/collab/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId }),
      });
    } catch {}
  };

  if (loading) return null;

  // Not opted in
  if (!profile?.enabled) {
    return (
      <div className="bg-surface border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2.5">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-[10px] font-semibold text-accent-light">
            Collab Finder
          </span>
        </div>
        <div className="px-5 py-5">
          <p className="text-sm text-white/80 leading-relaxed mb-4">
            Find live streamers in your game with a similar audience size. Get matched based on what you actually stream.
          </p>
          <button
            onClick={handleOptIn}
            disabled={optingIn}
            className="inline-flex items-center gap-2 bg-accent hover:opacity-85 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-all duration-300 hover:-translate-y-px"
          >
            <Users size={14} />
            {optingIn ? "Finding matches..." : "Find Collab Partners"}
          </button>
        </div>
      </div>
    );
  }

  // Opted in but no suggestions
  if (suggestions.length === 0) {
    return (
      <div className="bg-surface border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-[10px] font-semibold text-accent-light">
            Collab Finder
          </span>
        </div>
        <div className="px-5 py-5">
          <p className="text-sm text-white/80 leading-relaxed mb-4">
            Find live streamers in your game with a similar audience.
          </p>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 bg-accent hover:opacity-85 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-all duration-300 hover:-translate-y-px"
          >
            <Zap size={14} />
            {refreshing ? "Finding matches..." : "Find Matches"}
          </button>
        </div>
      </div>
    );
  }

  // Has matches — show inline, no expand needed
  return (
    <div className="bg-surface border border-white/[0.06] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-[10px] font-semibold text-accent-light">
            Collab Finder
          </span>
          <span className="text-xs text-muted">{suggestions.length} match{suggestions.length !== 1 ? "es" : ""} this week</span>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-white transition-colors disabled:opacity-40"
        >
          <RefreshCw size={11} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Finding..." : "Refresh"}
        </button>
      </div>

      {/* Match list — always visible */}
      <div className="divide-y divide-border">
        {suggestions.map((s) => (
          <MatchRow key={s.id} suggestion={s} onDismiss={handleDismiss} />
        ))}
      </div>
    </div>
  );
}

function MatchRow({ suggestion, onDismiss }: { suggestion: CollabSuggestion; onDismiss: (id: string) => void }) {
  const twitchUrl = suggestion.twitch_login ? `https://twitch.tv/${suggestion.twitch_login}` : null;
  const whisperUrl = suggestion.twitch_login ? `https://twitch.tv/message/compose?to=${suggestion.twitch_login}` : null;

  return (
    <div className="flex items-center gap-3 px-4 sm:px-5 py-3 sm:py-3.5 hover:bg-white/[0.02] transition-colors group">
      {/* Avatar */}
      {suggestion.avatar_url ? (
        <img src={suggestion.avatar_url} alt={suggestion.display_name} className="w-10 h-10 rounded-full flex-shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
          <Users size={14} className="text-accent-light" />
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white truncate">{suggestion.display_name}</span>
          <span className="text-xs font-bold text-accent-light flex-shrink-0">{suggestion.match_score}%</span>
          {suggestion.is_external && (
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">Live</span>
          )}
        </div>
        <p className="text-xs text-muted mt-0.5 truncate">{suggestion.reasons?.[0] || ""}</p>
      </div>

      {/* Actions — always visible on mobile, hover-reveal on desktop */}
      <div className="flex items-center gap-1.5 flex-shrink-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        {whisperUrl && (
          <a href={whisperUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-accent/10 hover:bg-accent/20 rounded-full transition-colors text-xs font-semibold text-accent-light">
            <MessageCircle size={11} /><span className="hidden sm:inline">Message</span>
          </a>
        )}
        {twitchUrl && (
          <a href={twitchUrl} target="_blank" rel="noopener noreferrer"
            className="p-1.5 hover:bg-white/5 rounded-full transition-colors">
            <ExternalLink size={13} className="text-muted" />
          </a>
        )}
        <button onClick={() => onDismiss(suggestion.id)} className="p-1.5 hover:bg-white/5 rounded-full transition-colors" title="Dismiss">
          <X size={13} className="text-muted/50" />
        </button>
      </div>
    </div>
  );
}
