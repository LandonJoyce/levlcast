"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Swords, X, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface RivalData {
  rivalLogin: string;
  rivalName: string | null;
  rivalFound: boolean;
  myScore: number | null;
  rivalScore: number | null;
  myStreak: number;
  rivalStreak: number;
  myWins?: number;
  rivalWins?: number;
  headToHeadCount?: number;
}

export function RivalWidget({ initial }: { initial: RivalData | null }) {
  const router = useRouter();
  const [rival, setRival] = useState<RivalData | null>(initial);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function setRivalByLogin() {
    const login = input.trim().toLowerCase();
    if (!login) return;
    setError(null);
    setNotice(null);

    startTransition(async () => {
      const res = await fetch("/api/rivals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ twitchLogin: login }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to set rival"); return; }
      if (!data.found) {
        setRival({ rivalLogin: login, rivalName: login, rivalFound: false, myScore: initial?.myScore ?? null, rivalScore: null, myStreak: initial?.myStreak ?? 0, rivalStreak: 0, myWins: 0, rivalWins: 0, headToHeadCount: 0 });
        setNotice("Rival set — they're not on LevlCast yet. Invite them to start the head-to-head.");
        setInput("");
        router.refresh();
        return;
      }
      setRival({ rivalLogin: login, rivalName: data.rival?.twitch_display_name ?? login, rivalFound: true, myScore: initial?.myScore ?? null, rivalScore: null, myStreak: initial?.myStreak ?? 0, rivalStreak: 0, myWins: 0, rivalWins: 0, headToHeadCount: 0 });
      setInput("");
      router.refresh();
    });
  }

  async function clearRival() {
    await fetch("/api/rivals", { method: "DELETE" });
    setRival(null);
    setNotice(null);
    router.refresh();
  }

  const myScore = rival?.myScore ?? null;
  const rivalScore = rival?.rivalScore ?? null;
  const delta = myScore !== null && rivalScore !== null ? myScore - rivalScore : null;

  return (
    <div className="rounded-2xl p-5 relative overflow-hidden" style={{ background: "rgba(10,9,20,0.98)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="absolute top-0 left-0 w-24 h-px" style={{ background: "linear-gradient(90deg, rgba(239,68,68,0.5), transparent)" }} />

      <div className="flex items-center gap-2 mb-4">
        <Swords size={12} className="text-red-400" />
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-red-400">Rival</span>
        {rival && (
          <button onClick={clearRival} className="ml-auto text-white/20 hover:text-white/60 transition-colors">
            <X size={12} />
          </button>
        )}
      </div>

      {!rival ? (
        <div>
          <p className="text-xs text-white/45 mb-3 leading-relaxed">Pick a rival streamer on LevlCast. Their score vs yours, every stream.</p>
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setRivalByLogin()}
              placeholder="Twitch username"
              className="flex-1 text-sm bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-white placeholder-white/25 focus:outline-none focus:border-red-400/40 transition-colors"
            />
            <button
              onClick={setRivalByLogin}
              disabled={isPending || !input.trim()}
              className="text-xs font-bold px-3.5 py-2 rounded-xl transition-all disabled:opacity-40"
              style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}
            >
              {isPending ? "..." : "Set"}
            </button>
          </div>
          {error && <p className="text-xs text-red-400/80 mt-2">{error}</p>}
          {notice && <p className="text-xs text-violet-400/80 mt-2">{notice}</p>}
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="text-center flex-1">
              <p className="text-[10px] text-white/30 font-semibold uppercase tracking-wide mb-1">You</p>
              {myScore !== null
                ? <p className={`text-3xl font-black tabular-nums ${myScore >= 75 ? "text-green-400" : myScore >= 50 ? "text-yellow-400" : "text-red-400"}`}>{myScore}</p>
                : <p className="text-sm text-white/25">No data</p>}
            </div>

            <div className="text-center">
              {delta !== null ? (
                <div className={`text-lg font-black ${delta > 0 ? "text-green-400" : delta < 0 ? "text-red-400" : "text-white/30"}`}>
                  {delta > 0 ? <TrendingUp size={20} /> : delta < 0 ? <TrendingDown size={20} /> : <Minus size={20} />}
                </div>
              ) : (
                <Swords size={16} className="text-white/20" />
              )}
            </div>

            <div className="text-center flex-1">
              <p className="text-[10px] text-white/30 font-semibold uppercase tracking-wide mb-1">{rival.rivalName ?? rival.rivalLogin}</p>
              {rivalScore !== null
                ? <p className={`text-3xl font-black tabular-nums ${rivalScore >= 75 ? "text-green-400" : rivalScore >= 50 ? "text-yellow-400" : "text-red-400"}`}>{rivalScore}</p>
                : <p className="text-sm text-white/25">No data yet</p>}
            </div>
          </div>

          {delta !== null && (
            <p className="text-xs text-center font-semibold">
              {delta > 0
                ? <span className="text-green-400">You&apos;re ahead by {delta} points</span>
                : delta < 0
                ? <span className="text-red-400">Behind by {Math.abs(delta)} points — step it up</span>
                : <span className="text-white/30">Dead even</span>}
            </p>
          )}

          {(rival.headToHeadCount ?? 0) >= 2 && (
            <div className="flex items-center justify-center gap-3 mt-3 pt-3 border-t border-white/[0.05]">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/35">Head-to-head</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold tabular-nums">
                <span className="text-green-400">{rival.myWins}W</span>
                <span className="text-white/20">·</span>
                <span className="text-red-400">{rival.rivalWins}L</span>
                {(rival.headToHeadCount! - (rival.myWins ?? 0) - (rival.rivalWins ?? 0)) > 0 && (
                  <>
                    <span className="text-white/20">·</span>
                    <span className="text-white/40">{rival.headToHeadCount! - (rival.myWins ?? 0) - (rival.rivalWins ?? 0)}T</span>
                  </>
                )}
                <span className="text-white/25 font-normal">last {rival.headToHeadCount}</span>
              </div>
            </div>
          )}

          {!rival.rivalFound && (
            <p className="text-xs text-white/30 text-center mt-2">Rival hasn&apos;t analyzed a stream yet</p>
          )}
        </div>
      )}
    </div>
  );
}
