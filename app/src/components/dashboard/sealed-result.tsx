"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { UpgradeModal } from "./upgrade-modal";

/**
 * A sealed report, and the moment it opens.
 *
 * The streamer calls it first: did that stream win or lose? Then a reel
 * spins between WIN and LOSS and lands on the real result, the points
 * pop, and the page reloads into the full report with the rank counting
 * up. The call is kept, so match history can say "Called it". Guessing
 * how a stream went is also the most useful habit a streamer can build:
 * you learn fastest when you commit to a read and then check it.
 *
 * A placement has no win or loss, so it just reveals. A locked extra
 * stream (a free streamer's third of the week) shows when it opens and
 * the Pro way to open it now.
 */

type Phase = "idle" | "sending" | "rolling" | "landed" | "error";

interface Props {
  vodId: string;
  /** Stream title, shown on the home card. */
  title?: string | null;
  placement: boolean;
  locked: { opensAt: string } | null;
  variant: "page" | "home";
}

interface OpenReply {
  delta: number | null;
  call: "win" | "loss" | null;
  placement: boolean;
}

// The reel: alternating words, landing on the last one. Long enough to
// feel like it's deciding, short enough not to drag.
const REEL_STEPS = 14;
const REEL_MS = 2100;

function untilText(iso: string): string {
  const ms = Math.max(0, Date.parse(iso) - Date.now());
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${Math.max(1, m)}m`;
}

export function SealedResult({ vodId, title, placement, locked, variant }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [picked, setPicked] = useState<"win" | "loss" | null>(null);
  const [reply, setReply] = useState<OpenReply | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [, tick] = useState(0);
  const reel = useRef<HTMLDivElement>(null);

  // Keep the lock countdown current.
  useEffect(() => {
    if (!locked) return;
    const t = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, [locked]);

  async function open(call: "win" | "loss" | null) {
    setPicked(call);
    setPhase("sending");
    setError(null);
    try {
      const res = await fetch(`/api/vods/${vodId}/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ call }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error === "locked" ? "This one is still locked." : "That didn't open. Try again.");
        setPhase("error");
        return;
      }
      const r: OpenReply = { delta: json.delta ?? null, call: json.call ?? null, placement: !!json.placement };
      setReply(r);

      // A placement's reveal is the rank itself: the stream page plays it.
      if (r.placement || r.delta == null) {
        if (variant === "home") router.push(`/dashboard/vods/${vodId}`);
        else router.refresh();
        return;
      }

      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setPhase(still ? "landed" : "rolling");
      if (!still) setTimeout(() => setPhase("landed"), REEL_MS + 50);
      setTimeout(() => router.refresh(), (still ? 0 : REEL_MS) + 2300);
    } catch {
      setError("That didn't open. Try again.");
      setPhase("error");
    }
  }

  // Start the reel once it's on screen.
  useEffect(() => {
    if (phase !== "rolling" || !reel.current) return;
    const el = reel.current;
    requestAnimationFrame(() => {
      el.style.transform = `translateY(calc(-${REEL_STEPS - 1} * var(--sr-row)))`;
    });
  }, [phase]);

  const won = reply?.delta != null && reply.delta > 0;
  const lost = reply?.delta != null && reply.delta < 0;
  const final = won ? "Win" : lost ? "Loss" : "Held";
  const words = Array.from({ length: REEL_STEPS }, (_, i) =>
    i === REEL_STEPS - 1 ? final : (REEL_STEPS - 1 - i) % 2 === 1 ? (won ? "Loss" : "Win") : final
  );
  const callLine =
    reply?.call == null || (!won && !lost)
      ? null
      : (reply.call === "win") === won
        ? "Called it."
        : `You called ${reply.call === "win" ? "a win" : "a loss"}.`;

  if (locked) {
    return (
      <section className="sr" data-variant={variant} data-locked="yes">
        <p className="hm-k">
          <span className="sr-k-lock">
            <Lock size={12} strokeWidth={2.2} aria-hidden="true" /> Sealed until Monday
          </span>
          <span>Opens in {untilText(locked.opensAt)}</span>
        </p>
        {title && variant === "home" && <p className="hm-last-title">{title}</p>}
        <p className="sr-title">Your extra stream is in.</p>
        <p className="sr-sub">
          Free comes with 1 report a week, so this one stays sealed until Monday. Pro opens it now.
        </p>
        <div className="sr-actions">
          <button type="button" className="btn btn-blue" onClick={() => setUpgradeOpen(true)}>
            Open it now with Pro
          </button>
        </div>
        <UpgradeModal
          isOpen={upgradeOpen}
          onClose={() => setUpgradeOpen(false)}
          reason="Pro opens sealed streams the moment they're in, coaches whole streams, and gives you 20 reports a month."
        />
      </section>
    );
  }

  return (
    <section className="sr" data-variant={variant} data-phase={phase}>
      <p className="hm-k">
        {placement ? "Your placement" : "Result"}
        <span>Sealed</span>
      </p>
      {title && variant === "home" && <p className="hm-last-title">{title}</p>}

      {phase === "rolling" || phase === "landed" ? (
        <div className="sr-verdict" data-r={won ? "win" : lost ? "loss" : "held"} aria-live="polite">
          <div className="sr-window">
            <div className="sr-reel" ref={reel} style={phase === "landed" ? { transition: "none", transform: `translateY(calc(-${REEL_STEPS - 1} * var(--sr-row)))` } : undefined}>
              {words.map((w, i) => (
                <span key={i} data-last={i === REEL_STEPS - 1 ? "yes" : undefined}>
                  {w}
                </span>
              ))}
            </div>
          </div>
          {phase === "landed" && reply?.delta != null && (
            <span className="sr-delta">{reply.delta > 0 ? `+${reply.delta}` : `−${Math.abs(reply.delta)}`}</span>
          )}
          {phase === "landed" && callLine && (
            <p className="sr-call" data-hit={callLine === "Called it." ? "yes" : undefined}>
              {callLine}
            </p>
          )}
        </div>
      ) : placement ? (
        <>
          <p className="sr-title">Your placement is in.</p>
          <p className="sr-sub">Your first report puts you on the ladder. See where you landed.</p>
          <div className="sr-actions">
            <button type="button" className="btn btn-blue" disabled={phase === "sending"} onClick={() => open(null)}>
              {phase === "sending" ? "Opening..." : "Reveal my rank"}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="sr-title">Your result is in.</p>
          <p className="sr-sub">Call it before you open it. Did that stream win or lose?</p>
          <div className="sr-calls">
            <button type="button" className="sr-call-btn" data-pick="win" data-picked={picked === "win" ? "yes" : undefined} disabled={phase === "sending"} onClick={() => open("win")}>
              Win
            </button>
            <button type="button" className="sr-call-btn" data-pick="loss" data-picked={picked === "loss" ? "yes" : undefined} disabled={phase === "sending"} onClick={() => open("loss")}>
              Loss
            </button>
          </div>
          <button type="button" className="sr-skip" disabled={phase === "sending"} onClick={() => open(null)}>
            {phase === "sending" ? "Opening..." : "Just open it"}
          </button>
        </>
      )}
      {error && <p className="sr-error">{error}</p>}
    </section>
  );
}
