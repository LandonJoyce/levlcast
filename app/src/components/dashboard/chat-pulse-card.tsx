"use client";

/**
 * ChatPulseCard — visualizes the bucketed chat pulse as a timeline.
 *
 * The viz is intentionally honest: bar height = message volume,
 * bar color = vibe (green = laughs/hype dominant, red = sad/cringe
 * dominant, neutral gray when balanced). Notable moments (sub bursts,
 * raids, big spikes/drops) get markers above the timeline.
 *
 * This is the platform-integration moat made visible — the report says
 * "your chat behaved THIS way" with actual viewer data, not Claude
 * guessing whether a joke landed.
 */

import { useMemo } from "react";

interface ChatBucket {
  start: number;
  end: number;
  count: number;
  uniqueChatters: number;
  laughCount: number;
  hypeCount: number;
  sadCount: number;
  subEvents: number;
  bitEvents: number;
  raidEvents: number;
  vibe: number;
}

function fmtTime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function vibeColor(b: ChatBucket): string {
  // Mostly hype/laughs vs sad/cringe vs neutral. The 0.4 thresholds keep
  // single-laugh-in-quiet-bucket noise from flipping the color.
  if (b.count === 0) return "rgba(255,255,255,0.06)";
  const positive = b.laughCount + b.hypeCount;
  const total = positive + b.sadCount;
  if (total === 0) return "rgba(167,139,250,0.65)"; // neutral / mostly chatter
  const posShare = positive / total;
  if (posShare >= 0.65) return "#A3E635"; // green — laughs/hype dominant
  if (posShare <= 0.35) return "#F87171"; // red — sad/cringe dominant
  return "rgba(167,139,250,0.65)";        // mixed
}

export function ChatPulseCard({ buckets, durationSeconds }: { buckets: ChatBucket[]; durationSeconds?: number }) {
  const total = useMemo(() => buckets.reduce((s, b) => s + b.count, 0), [buckets]);
  const peak = useMemo(() => buckets.reduce((m, b) => (b.count > m ? b.count : m), 0), [buckets]);
  const totalLaugh = useMemo(() => buckets.reduce((s, b) => s + b.laughCount, 0), [buckets]);
  const totalHype = useMemo(() => buckets.reduce((s, b) => s + b.hypeCount, 0), [buckets]);
  const totalSad = useMemo(() => buckets.reduce((s, b) => s + b.sadCount, 0), [buckets]);
  const subEvents = useMemo(() => buckets.reduce((s, b) => s + b.subEvents, 0), [buckets]);
  const bitEvents = useMemo(() => buckets.reduce((s, b) => s + b.bitEvents, 0), [buckets]);
  const raidEvents = useMemo(() => buckets.reduce((s, b) => s + b.raidEvents, 0), [buckets]);

  if (total === 0) return null;

  const totalDuration = durationSeconds ?? buckets[buckets.length - 1].end;

  return (
    <div style={{
      margin: "32px 0",
      padding: "24px 26px",
      borderRadius: 12,
      background: "rgba(255,255,255,0.025)",
      border: "1px solid rgba(255,255,255,0.08)",
    }}>
      {/* Eyebrow */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 4 }}>
        <h2 style={{
          fontFamily: '"Instrument Serif", Georgia, serif', fontWeight: 400,
          fontSize: 28, lineHeight: 1, letterSpacing: "-0.015em", margin: 0, color: "#ECF1FA",
        }}>
          The <em style={{ fontStyle: "italic", color: "#a78bfa" }}>Chat Pulse.</em>
        </h2>
        <p style={{
          fontFamily: '"Instrument Serif", Georgia, serif', fontStyle: "italic",
          fontSize: 14, color: "#6F7C95", margin: 0, maxWidth: 280, textAlign: "right",
        }}>
          What your viewers actually did, second by second.
        </p>
      </div>

      <div style={{
        fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
        letterSpacing: "0.28em", textTransform: "uppercase", color: "#6F7C95",
        marginBottom: 22,
      }}>
        {total.toLocaleString()} messages · peak bucket: {peak}
      </div>

      {/* Top stats strip */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
        gap: 8, marginBottom: 26,
      }}>
        {totalLaugh > 0 && <PulseStat n={totalLaugh} label="Laughs" color="#A3E635" />}
        {totalHype > 0 && <PulseStat n={totalHype} label="Hype" color="#A3E635" />}
        {totalSad > 0 && <PulseStat n={totalSad} label="Sad / cringe" color="#F87171" />}
        {subEvents > 0 && <PulseStat n={subEvents} label="Sub events" color="#a78bfa" />}
        {bitEvents > 0 && <PulseStat n={bitEvents} label="Bit cheers" color="#22D3EE" />}
        {raidEvents > 0 && <PulseStat n={raidEvents} label="Raid arrivals" color="#F59E0B" />}
      </div>

      {/* Timeline */}
      <div style={{ position: "relative", padding: "8px 0 24px" }}>
        <div style={{
          position: "relative",
          height: 88,
          background: "rgba(255,255,255,0.025)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "flex-end",
          gap: 1,
          padding: "0 0",
        }}>
          {buckets.map((b, i) => {
            const heightPct = peak > 0 ? Math.max(2, (b.count / peak) * 100) : 0;
            const widthPct = 100 / buckets.length;
            const color = vibeColor(b);
            const tooltip = [
              `${fmtTime(b.start)}-${fmtTime(b.end)}`,
              `${b.count} messages · ${b.uniqueChatters} chatters`,
              b.laughCount ? `${b.laughCount} laughs` : null,
              b.hypeCount ? `${b.hypeCount} hype` : null,
              b.sadCount ? `${b.sadCount} sad/cringe` : null,
              b.subEvents ? `${b.subEvents} subs` : null,
              b.bitEvents ? `${b.bitEvents} bits` : null,
              b.raidEvents ? `raid` : null,
            ].filter(Boolean).join("\n");

            return (
              <div
                key={i}
                title={tooltip}
                style={{
                  flex: `0 0 ${widthPct}%`,
                  height: `${heightPct}%`,
                  background: color,
                  borderRadius: "2px 2px 0 0",
                  transition: "filter 120ms",
                  cursor: "pointer",
                }}
              />
            );
          })}

          {/* Event overlay markers — subs/bits/raids on top */}
          {buckets.map((b, i) => {
            const hasEvent = b.subEvents > 0 || b.bitEvents > 0 || b.raidEvents > 0;
            if (!hasEvent) return null;
            const pct = ((b.start + (b.end - b.start) / 2) / totalDuration) * 100;
            const color = b.raidEvents > 0 ? "#F59E0B" : b.bitEvents > 0 ? "#22D3EE" : "#a78bfa";
            return (
              <div
                key={`evt-${i}`}
                title={
                  (b.raidEvents > 0 ? "Raid · " : "") +
                  (b.subEvents > 0 ? `${b.subEvents} subs · ` : "") +
                  (b.bitEvents > 0 ? `${b.bitEvents} bits · ` : "") +
                  fmtTime(b.start)
                }
                style={{
                  position: "absolute",
                  top: -6,
                  left: `${pct}%`,
                  width: 8, height: 8,
                  borderRadius: "50%",
                  background: color,
                  transform: "translateX(-50%)",
                  border: "2px solid rgba(10,9,20,0.85)",
                  pointerEvents: "none",
                }}
              />
            );
          })}
        </div>

        {/* Time markers */}
        <div style={{ position: "relative", height: 18, marginTop: 6 }}>
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const t = Math.round(pct * totalDuration);
            return (
              <span
                key={pct}
                style={{
                  position: "absolute",
                  left: `${pct * 100}%`,
                  transform: pct === 0 ? "none" : pct === 1 ? "translateX(-100%)" : "translateX(-50%)",
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: 10,
                  color: "#6F7C95",
                  letterSpacing: "0.06em",
                }}
              >
                {fmtTime(t)}
              </span>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div style={{
        display: "flex", gap: 16, flexWrap: "wrap",
        fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
        color: "#6F7C95", letterSpacing: "0.06em", textTransform: "uppercase",
      }}>
        <LegendDot color="#A3E635" label="Laughs / Hype" />
        <LegendDot color="rgba(167,139,250,0.65)" label="Mixed / Chatter" />
        <LegendDot color="#F87171" label="Sad / Cringe" />
        {(subEvents > 0 || bitEvents > 0 || raidEvents > 0) && (
          <span style={{ marginLeft: "auto", display: "flex", gap: 12 }}>
            {subEvents > 0 && <LegendDot color="#a78bfa" label="Sub" small />}
            {bitEvents > 0 && <LegendDot color="#22D3EE" label="Bits" small />}
            {raidEvents > 0 && <LegendDot color="#F59E0B" label="Raid" small />}
          </span>
        )}
      </div>
    </div>
  );
}

function PulseStat({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <div style={{
      padding: "10px 12px",
      borderRadius: 8,
      background: "rgba(255,255,255,0.025)",
      border: "1px solid rgba(255,255,255,0.07)",
    }}>
      <div style={{
        fontFamily: '"Instrument Serif", Georgia, serif', fontSize: 22, lineHeight: 1,
        color, letterSpacing: "-0.02em", marginBottom: 4,
      }}>
        {n.toLocaleString()}
      </div>
      <div style={{
        fontFamily: '"JetBrains Mono", monospace', fontSize: 9, fontWeight: 700,
        color: "#6F7C95", letterSpacing: "0.16em", textTransform: "uppercase",
      }}>
        {label}
      </div>
    </div>
  );
}

function LegendDot({ color, label, small }: { color: string; label: string; small?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{
        display: "inline-block",
        width: small ? 6 : 8, height: small ? 6 : 8,
        borderRadius: "50%", background: color,
      }} />
      {label}
    </span>
  );
}
