interface Snapshot {
  follower_count: number;
  snapped_at: string;
}

interface Props {
  snapshots: Snapshot[];
  streamDates: string[]; // YYYY-MM-DD strings of analyzed streams
}

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

export function FollowerBriefCard({ snapshots, streamDates }: Props) {
  if (snapshots.length === 0) return null;

  const sorted = [...snapshots].sort((a, b) => a.snapped_at.localeCompare(b.snapped_at));
  const latest = sorted[sorted.length - 1];
  const current = latest.follower_count;

  // Delta from yesterday
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = dayKey(yesterday.toISOString());
  const yesterdaySnap = sorted.findLast((s) => dayKey(s.snapped_at) <= yesterdayKey);
  const deltaDay = yesterdaySnap ? current - yesterdaySnap.follower_count : null;

  // Delta from 7 days ago
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoKey = dayKey(weekAgo.toISOString());
  const weekSnap = sorted.findLast((s) => dayKey(s.snapped_at) <= weekAgoKey);
  const deltaWeek = weekSnap ? current - weekSnap.follower_count : null;

  // Stream day correlation — need 14+ days and 3+ stream days
  const streamDaySet = new Set(streamDates.map((d) => d.slice(0, 10)));
  let streamDayAvg: number | null = null;
  let nonStreamDayAvg: number | null = null;

  if (sorted.length >= 14 && streamDaySet.size >= 3) {
    const streamDeltas: number[] = [];
    const nonStreamDeltas: number[] = [];

    for (let i = 1; i < sorted.length; i++) {
      const delta = sorted[i].follower_count - sorted[i - 1].follower_count;
      const date = dayKey(sorted[i].snapped_at);
      if (streamDaySet.has(date)) {
        streamDeltas.push(delta);
      } else {
        nonStreamDeltas.push(delta);
      }
    }

    if (streamDeltas.length >= 2 && nonStreamDeltas.length >= 2) {
      streamDayAvg = Math.round((streamDeltas.reduce((a, b) => a + b, 0) / streamDeltas.length) * 10) / 10;
      nonStreamDayAvg = Math.round((nonStreamDeltas.reduce((a, b) => a + b, 0) / nonStreamDeltas.length) * 10) / 10;
    }
  }

  const multiplier = streamDayAvg !== null && nonStreamDayAvg !== null && nonStreamDayAvg > 0
    ? Math.round((streamDayAvg / nonStreamDayAvg) * 10) / 10
    : null;

  const fmtDelta = (n: number) => `${n >= 0 ? "+" : ""}${n}`;
  const deltaColor = (n: number) => n > 0 ? "var(--green)" : n < 0 ? "var(--danger)" : "var(--ink-3)";

  return (
    <div className="card card-pad">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
        <span className="mono-label">Follower Growth</span>
        {snapshots.length < 7 && (
          <span style={{ fontSize: 11, color: "var(--ink-3)" }}>building data...</span>
        )}
      </div>

      <div className="row" style={{ alignItems: "flex-end", gap: 20, flexWrap: "wrap" }}>
        {/* Current count */}
        <div>
          <div style={{ fontSize: 38, fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1, color: "var(--ink)" }}>
            {current.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4, letterSpacing: "0.04em", fontFamily: "var(--font-geist-mono), monospace" }}>
            FOLLOWERS
          </div>
        </div>

        {/* Deltas */}
        <div style={{ display: "flex", gap: 12, paddingBottom: 4 }}>
          {deltaDay !== null && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: deltaColor(deltaDay), lineHeight: 1 }}>
                {fmtDelta(deltaDay)}
              </div>
              <div style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 3, letterSpacing: "0.04em" }}>TODAY</div>
            </div>
          )}
          {deltaWeek !== null && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: deltaColor(deltaWeek), lineHeight: 1 }}>
                {fmtDelta(deltaWeek)}
              </div>
              <div style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 3, letterSpacing: "0.04em" }}>THIS WEEK</div>
            </div>
          )}
        </div>
      </div>

      {/* Stream day insight */}
      {multiplier !== null && multiplier > 1.2 && streamDayAvg !== null && (
        <div style={{
          marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line)",
          fontSize: 13, color: "var(--ink-2)", lineHeight: 1.55,
        }}>
          On days you stream you gain{" "}
          <span style={{ color: "var(--green)", fontWeight: 700 }}>{multiplier}x</span>
          {" "}more followers than days you don&apos;t.
          {streamDayAvg > 0 && (
            <span style={{ color: "var(--ink-3)" }}> ({fmtDelta(streamDayAvg)} avg on stream days)</span>
          )}
        </div>
      )}
    </div>
  );
}
