"use client";

import { useEffect, useState } from "react";
import { Users, ChevronDown, ChevronUp, ExternalLink, X, MessageCircle, RefreshCw } from "lucide-react";

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
  const [expanded, setExpanded] = useState(false);
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
      const res = await fetch("/api/collab/refresh", { method: "POST" });
      const debug = await res.json();
      console.log("[collab] refresh result:", debug);
      // Reload suggestions
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
      // Run matching immediately on opt-in
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

  // Not opted in — show opt-in prompt
  if (!profile?.enabled) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-surface p-5">
        <div className="flex items-center gap-2 mb-3">
          <Users size={16} className="text-accent-light" />
          <span className="text-xs font-medium text-muted">
            Collab Finder
          </span>
        </div>
        <p className="text-sm text-white/80 mb-4 leading-relaxed">
          Find streamers to collab with based on your content style, audience size, and strengths. Opt in to get matched weekly.
        </p>
        <button
          onClick={handleOptIn}
          disabled={optingIn}
          className="bg-accent hover:opacity-85 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-opacity disabled:opacity-50"
        >
          {optingIn ? "Joining..." : "Join Collab Matching"}
        </button>
      </div>
    );
  }

  // Opted in but no suggestions yet
  if (suggestions.length === 0) {
    return (
      <div className="rounded-2xl border border-accent/20 bg-accent/[0.04] p-5">
        <div className="flex items-center gap-2 mb-3">
          <Users size={16} className="text-accent-light" />
          <span className="text-xs font-medium text-muted">Collab Finder</span>
        </div>
        <p className="text-sm text-white/80 leading-relaxed mb-4">
          You're in the matching pool. Find collab partners based on your content and audience.
        </p>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 bg-accent hover:opacity-85 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-full transition-all duration-300 hover:-translate-y-px"
        >
          <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Finding matches..." : "Find Matches"}
        </button>
      </div>
    );
  }

  // Has suggestions
  return (
    <div
      className="rounded-2xl border border-accent/20 bg-accent/[0.04] p-5 cursor-pointer transition-all"
      onClick={() => setExpanded(!expanded)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-accent-light" />
          <span className="text-xs font-medium text-muted">
            Collab Finder
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); handleRefresh(); }}
            disabled={refreshing}
            className="p-1 hover:bg-white/5 rounded-lg transition-colors disabled:opacity-40"
            title="Refresh matches"
          >
            <RefreshCw size={12} className={`text-muted ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <span className="text-sm font-bold text-accent-light">
            {suggestions.length} match{suggestions.length !== 1 ? "es" : ""}
          </span>
          {expanded
            ? <ChevronUp size={14} className="text-muted" />
            : <ChevronDown size={14} className="text-muted" />
          }
        </div>
      </div>

      {/* Top match preview */}
      <p className="text-sm text-white/80 leading-relaxed">
        Top match: <span className="font-semibold text-white">{suggestions[0].display_name}</span>
        {" — "}{suggestions[0].reasons?.[0] || "Great potential collab partner"}
      </p>

      {/* Expanded — full match list */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-white/5 space-y-3" onClick={(e) => e.stopPropagation()}>
          {suggestions.map((s) => (
            <MatchRow key={s.id} suggestion={s} onDismiss={handleDismiss} />
          ))}
        </div>
      )}
    </div>
  );
}

function MatchRow({ suggestion, onDismiss }: { suggestion: CollabSuggestion; onDismiss: (id: string) => void }) {
  const twitchUrl = suggestion.twitch_login
    ? `https://twitch.tv/${suggestion.twitch_login}`
    : null;
  const whisperUrl = suggestion.twitch_login
    ? `https://twitch.tv/message/compose?to=${suggestion.twitch_login}`
    : null;

  return (
    <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        {suggestion.avatar_url ? (
          <img src={suggestion.avatar_url} alt={suggestion.display_name} className="w-9 h-9 rounded-full flex-shrink-0 mt-0.5" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Users size={14} className="text-accent-light" />
          </div>
        )}

        {/* Name + score + dismiss */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold text-white truncate">{suggestion.display_name}</span>
              <span className="text-xs font-bold text-accent-light flex-shrink-0">{suggestion.match_score}%</span>
              {suggestion.is_external && (
                <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">Live</span>
              )}
            </div>
            <button onClick={() => onDismiss(suggestion.id)} className="p-1 hover:bg-white/5 rounded-lg transition-colors flex-shrink-0" title="Dismiss">
              <X size={13} className="text-muted/50" />
            </button>
          </div>

          {/* Reasons */}
          <div className="flex flex-wrap gap-1 mt-1.5">
            {suggestion.reasons.map((r, i) => (
              <span key={i} className="text-[11px] text-muted bg-white/5 px-2 py-0.5 rounded-full">{r}</span>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-2.5">
            {whisperUrl && (
              <a href={whisperUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 hover:bg-accent/20 rounded-full transition-colors text-xs font-semibold text-accent-light">
                <MessageCircle size={11} /> Message
              </a>
            )}
            {twitchUrl && (
              <a href={twitchUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/8 rounded-full transition-colors text-xs font-medium text-muted hover:text-white">
                <ExternalLink size={11} /> View
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
