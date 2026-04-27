"use client";

/**
 * AudienceSnapshotCard — shown in place of ChatPulseCard when chat
 * activity is below the threshold for a meaningful timeline. Most
 * small / new streamers will land here. The framing is intentionally
 * encouraging:
 *   - celebrate any sub/bit/raid that DID happen
 *   - track unique chatters (so streamer #2 sees growth between streams)
 *   - constructive nudge: how to actually get chat to talk
 *
 * No timeline. No bars at "0 height". Nothing that rubs in low engagement.
 */

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

export function AudienceSnapshotCard({ buckets }: { buckets: ChatBucket[] }) {
  let totalMessages = 0;
  let subEvents = 0;
  let bitEvents = 0;
  let raidEvents = 0;
  let firstAt: number | null = null;
  let peakUnique = 0;

  for (const b of buckets) {
    if (b.count > 0 && firstAt === null) firstAt = b.start;
    totalMessages += b.count;
    subEvents += b.subEvents;
    bitEvents += b.bitEvents;
    raidEvents += b.raidEvents;
    if (b.uniqueChatters > peakUnique) peakUnique = b.uniqueChatters;
  }

  // Honest framing — three different copy paths so the card feels
  // appropriate to actual chat volume, not generic.
  let headline: string;
  let body: string;
  if (totalMessages === 0) {
    headline = "Quiet stream — no chat caught.";
    body = "Either chat was empty or replay didn't capture it. Build chat habits early: ask a direct question every 15-20 minutes, and pause for an answer.";
  } else if (totalMessages < 10) {
    headline = "A few real viewers showed up.";
    body = "When chat is small, every message matters. Use names back, react to what they say, and the next stream usually doubles.";
  } else {
    headline = "Building an audience.";
    body = "Chat was active enough to track the trend, not enough to draw a meaningful timeline. The Last Stream Recap above will measure your delta as this number grows.";
  }

  return (
    <div style={{
      margin: "32px 0",
      padding: "24px 26px",
      borderRadius: 12,
      background: "rgba(255,255,255,0.025)",
      border: "1px solid rgba(255,255,255,0.08)",
    }}>
      {/* Eyebrow + headline */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 6 }}>
        <h2 style={{
          fontFamily: '"Instrument Serif", Georgia, serif', fontWeight: 400,
          fontSize: 26, lineHeight: 1.15, letterSpacing: "-0.015em", margin: 0, color: "#ECF1FA",
        }}>
          {headline}
        </h2>
        <p style={{
          fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
          letterSpacing: "0.28em", textTransform: "uppercase", color: "#6F7C95",
          margin: 0,
        }}>
          Audience Snapshot
        </p>
      </div>

      <p style={{
        fontFamily: '"Instrument Serif", Georgia, serif', fontStyle: "italic",
        fontSize: 14, color: "#A6B3C9", lineHeight: 1.5, margin: "8px 0 22px", maxWidth: "62ch",
      }}>
        {body}
      </p>

      {/* Stats — only shown when there's something */}
      {totalMessages > 0 && (
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: 8, marginBottom: subEvents + bitEvents + raidEvents > 0 ? 14 : 0,
        }}>
          <Stat n={totalMessages} label="Chat messages" />
          <Stat n={peakUnique} label="Active chatters" />
          {firstAt !== null && (
            <div style={{
              padding: "10px 12px", borderRadius: 8,
              background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)",
            }}>
              <div style={{
                fontFamily: '"Instrument Serif", Georgia, serif', fontSize: 22, lineHeight: 1,
                color: "#ECF1FA", letterSpacing: "-0.02em", marginBottom: 4,
              }}>
                {fmtTime(firstAt)}
              </div>
              <div style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: 9, fontWeight: 700,
                color: "#6F7C95", letterSpacing: "0.16em", textTransform: "uppercase",
              }}>
                First Message
              </div>
            </div>
          )}
        </div>
      )}

      {/* Celebration row — wins worth noticing even if chat was small */}
      {(subEvents > 0 || bitEvents > 0 || raidEvents > 0) && (
        <div style={{
          padding: "12px 16px", borderRadius: 8,
          background: "linear-gradient(135deg, rgba(167,139,250,0.08), rgba(34,211,238,0.04))",
          border: "1px solid rgba(167,139,250,0.28)",
          display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center",
        }}>
          <div style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 9, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.28em", color: "#c4b5fd",
          }}>
            What did happen
          </div>
          {subEvents > 0 && (
            <span style={{ fontSize: 13, color: "#ECF1FA" }}>
              <strong style={{ color: "#a78bfa" }}>{subEvents}</strong> sub event{subEvents !== 1 ? "s" : ""}
            </span>
          )}
          {bitEvents > 0 && (
            <span style={{ fontSize: 13, color: "#ECF1FA" }}>
              <strong style={{ color: "#22D3EE" }}>{bitEvents}</strong> bit cheer{bitEvents !== 1 ? "s" : ""}
            </span>
          )}
          {raidEvents > 0 && (
            <span style={{ fontSize: 13, color: "#ECF1FA" }}>
              <strong style={{ color: "#F59E0B" }}>{raidEvents}</strong> raid arrival{raidEvents !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div style={{
      padding: "10px 12px",
      borderRadius: 8,
      background: "rgba(255,255,255,0.025)",
      border: "1px solid rgba(255,255,255,0.07)",
    }}>
      <div style={{
        fontFamily: '"Instrument Serif", Georgia, serif', fontSize: 26, lineHeight: 1,
        color: "#ECF1FA", letterSpacing: "-0.02em", marginBottom: 4,
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
