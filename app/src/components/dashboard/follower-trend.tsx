"use client";

import { useEffect, useState } from "react";
import { TrendingUp, RefreshCw } from "lucide-react";

interface Snapshot {
  follower_count: number;
  snapped_at: string;
}

interface Props {
  snapshots: Snapshot[];
  needsReconnect: boolean;
}

export function FollowerTrend({ snapshots, needsReconnect }: Props) {
  const [triggered, setTriggered] = useState(false);

  useEffect(() => {
    if (!triggered) {
      setTriggered(true);
      fetch("/api/analytics/snapshot", { method: "POST" }).catch(() => {});
    }
  }, [triggered]);

  if (needsReconnect || snapshots.length === 0) {
    const latest = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
    return (
      <div className="bg-surface border border-border rounded-2xl p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted mb-4">
          Follower Growth
        </h2>
        {needsReconnect ? (
          <div className="text-center py-6">
            <RefreshCw size={20} className="text-muted mx-auto mb-3" />
            <p className="text-sm text-muted mb-3">
              Reconnect Twitch to enable follower tracking.
            </p>
            <a
              href="/auth/login"
              className="text-xs font-semibold text-accent-light hover:underline"
            >
              Reconnect Twitch
            </a>
          </div>
        ) : (
          <p className="text-sm text-muted py-4 text-center">
            Follower data will appear after your first visit today.
          </p>
        )}
        {latest && (
          <p className="text-xs text-muted text-center mt-2">
            Last recorded: {latest.follower_count.toLocaleString()} followers
          </p>
        )}
      </div>
    );
  }

  const counts = snapshots.map((s) => s.follower_count);
  const min = Math.min(...counts);
  const max = Math.max(...counts);
  const range = max - min || 1;
  const latest = counts[counts.length - 1];
  const first = counts[0];
  const gained = latest - first;

  const points = snapshots.map((s, i) => {
    const x = snapshots.length === 1 ? 50 : (i / (snapshots.length - 1)) * 100;
    const y = 100 - ((s.follower_count - min) / range) * 80 - 10;
    return `${x},${y}`;
  });

  return (
    <div className="bg-surface border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
          Follower Growth
        </h2>
        {gained > 0 && (
          <span className="text-xs font-semibold text-green-400 flex items-center gap-1">
            <TrendingUp size={12} />
            +{gained.toLocaleString()}
          </span>
        )}
      </div>
      <p className="text-3xl font-extrabold mb-4">{latest.toLocaleString()}</p>

      {/* Line chart */}
      <div className="h-24 w-full">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
          <defs>
            <linearGradient id="followerGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Fill area */}
          <polygon
            points={`0,100 ${points.join(" ")} 100,100`}
            fill="url(#followerGradient)"
          />
          {/* Line */}
          <polyline
            points={points.join(" ")}
            fill="none"
            stroke="#a78bfa"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
          {/* Data points */}
          {snapshots.map((_, i) => {
            const [x, y] = points[i].split(",").map(Number);
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="2"
                fill="#a78bfa"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>
      </div>

      <div className="flex justify-between text-xs text-muted mt-2">
        <span>{new Date(snapshots[0].snapped_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
        <span>{new Date(snapshots[snapshots.length - 1].snapped_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
      </div>
    </div>
  );
}
