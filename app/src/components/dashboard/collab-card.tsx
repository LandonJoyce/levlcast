"use client";

import { useEffect, useState } from "react";
import { Users, ChevronDown, ChevronUp, ExternalLink, X, MessageCircle } from "lucide-react";

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

  const handleOptIn = async () => {
    setOptingIn(true);
    try {
      await fetch("/api/collab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true }),
      });
      setProfile({ enabled: true, tagline: null, preferred_categories: [] });
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
          <span className="text-xs font-medium text-muted">
            Collab Finder
          </span>
        </div>
        <p className="text-sm text-white/80 leading-relaxed">
          You're in the matching pool. We'll find collab partners for you every Monday based on your content and audience.
        </p>
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
    <div className="flex items-start gap-3 bg-white/[0.03] rounded-xl p-3 border border-white/5">
      {/* Avatar */}
      {suggestion.avatar_url ? (
        <img
          src={suggestion.avatar_url}
          alt={suggestion.display_name}
          className="w-10 h-10 rounded-full flex-shrink-0"
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
          <Users size={16} className="text-accent-light" />
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-white">{suggestion.display_name}</span>
          <span className="text-xs font-bold text-accent-light">{suggestion.match_score}%</span>
          {suggestion.is_external && (
            <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-full font-semibold">Twitch</span>
          )}
          {suggestion.follower_count != null && suggestion.follower_count > 0 && (
            <span className="text-[10px] text-muted">{suggestion.follower_count.toLocaleString()} followers</span>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {suggestion.reasons.map((r, i) => (
            <span key={i} className="text-[11px] text-muted bg-white/5 px-2 py-0.5 rounded-full">
              {r}
            </span>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {whisperUrl && (
          <a
            href={whisperUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2.5 py-1.5 bg-accent/10 hover:bg-accent/20 rounded-lg transition-colors text-xs font-semibold text-accent-light"
            title="Send message on Twitch"
          >
            <MessageCircle size={12} />
            Message
          </a>
        )}
        {twitchUrl && (
          <a
            href={twitchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 hover:bg-white/5 rounded-lg transition-colors"
            title="View channel on Twitch"
          >
            <ExternalLink size={14} className="text-muted" />
          </a>
        )}
        <button
          onClick={() => onDismiss(suggestion.id)}
          className="p-1.5 hover:bg-white/5 rounded-lg transition-colors"
          title="Dismiss"
        >
          <X size={14} className="text-muted" />
        </button>
      </div>
    </div>
  );
}
