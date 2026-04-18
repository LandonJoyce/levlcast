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
      <div
        className="rounded-2xl relative overflow-hidden"
        style={{ background: "rgba(10,9,20,0.98)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="absolute top-0 left-0 w-24 h-px" style={{ background: "linear-gradient(90deg, rgba(139,92,246,0.6), transparent)" }} />
        <div className="px-6 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-violet-400 mb-0.5">Follower Growth</p>
          <h2 className="text-sm font-bold text-white">Your Twitch audience over time</h2>
        </div>
        <div className="px-6 py-8 text-center">
          {needsReconnect ? (
            <>
              <RefreshCw size={20} className="text-white/25 mx-auto mb-3" />
              <p className="text-sm text-white/50 mb-3">
                Reconnect Twitch to enable follower tracking.
              </p>
              <a href="/auth/login" className="text-xs font-bold text-violet-400 hover:text-violet-300 transition-colors">
                Reconnect Twitch →
              </a>
            </>
          ) : (
            <p className="text-sm text-white/50">
              Follower data will appear after your first visit today.
            </p>
          )}
          {latest && (
            <p className="text-xs text-white/35 text-center mt-3">
              Last recorded: <span className="font-bold text-white/60">{latest.follower_count.toLocaleString()}</span> followers
            </p>
          )}
        </div>
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

  const pulseHex = gained > 0 ? "#4ade80" : gained < 0 ? "#f87171" : "#a78bfa";

  return (
    <div
      className="rounded-2xl relative overflow-hidden"
      style={{
        background: `radial-gradient(ellipse 60% 50% at 50% 0%, ${pulseHex}10 0%, rgba(10,9,20,0) 65%), rgba(10,9,20,0.98)`,
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-px" style={{ background: `linear-gradient(90deg, transparent, ${pulseHex}60, transparent)` }} />

      <div className="px-6 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-violet-400 mb-0.5">Follower Growth</p>
            <h2 className="text-sm font-bold text-white">Your Twitch audience over time</h2>
          </div>
          {gained !== 0 && (
            <span className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full border ${gained > 0 ? "text-green-400" : "text-red-400"}`}
              style={{
                background: gained > 0 ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)",
                borderColor: gained > 0 ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)",
              }}
            >
              <TrendingUp size={11} className={gained < 0 ? "rotate-180" : ""} />
              {gained > 0 ? "+" : ""}{gained.toLocaleString()}
            </span>
          )}
        </div>
      </div>

      <div className="px-6 py-5">
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-4xl font-black tabular-nums leading-none text-white">{latest.toLocaleString()}</span>
          <span className="text-sm font-bold text-white/30">followers</span>
        </div>

        <div className="h-28 w-full">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
            <defs>
              <linearGradient id="followerGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={pulseHex} stopOpacity="0.35" />
                <stop offset="60%" stopColor={pulseHex} stopOpacity="0.08" />
                <stop offset="100%" stopColor={pulseHex} stopOpacity="0" />
              </linearGradient>
              <linearGradient id="followerLine" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={pulseHex} stopOpacity="0.6" />
                <stop offset="100%" stopColor={pulseHex} stopOpacity="1" />
              </linearGradient>
            </defs>
            <polygon points={`0,100 ${points.join(" ")} 100,100`} fill="url(#followerGradient)" />
            <polyline
              points={points.join(" ")}
              fill="none"
              stroke="url(#followerLine)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            {snapshots.map((_, i) => {
              const [x, y] = points[i].split(",").map(Number);
              const isLatest = i === snapshots.length - 1;
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r={isLatest ? 3 : 1.8}
                  fill={pulseHex}
                  vectorEffect="non-scaling-stroke"
                  style={isLatest ? { filter: `drop-shadow(0 0 4px ${pulseHex})` } : undefined}
                />
              );
            })}
          </svg>
        </div>

        <div className="flex justify-between text-[10px] font-semibold text-white/30 mt-3">
          <span>{new Date(snapshots[0].snapped_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
          <span>{new Date(snapshots[snapshots.length - 1].snapped_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
        </div>
      </div>
    </div>
  );
}
