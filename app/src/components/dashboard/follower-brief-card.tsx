interface Snapshot {
  follower_count: number;
  snapped_at: string;
}

interface Props {
  snapshots: Snapshot[];
  /** YYYY-MM-DD of each analyzed stream. */
  streamDates: string[];
}

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

/**
 * Followers, and whether streaming moves them. Sits under the record on
 * the Matches page: the ladder is how the streams went, this is whether
 * they're growing the channel.
 */
export function FollowerBriefCard({ snapshots, streamDates }: Props) {
  if (snapshots.length === 0) return null;

  const sorted = [...snapshots].sort((a, b) => a.snapped_at.localeCompare(b.snapped_at));
  const current = sorted[sorted.length - 1].follower_count;

  // Change over the last week, from the newest snapshot at least 7 days old.
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekSnap = sorted.filter((s) => dayKey(s.snapped_at) <= dayKey(weekAgo.toISOString())).pop();
  const deltaWeek = weekSnap ? current - weekSnap.follower_count : null;

  // Stream days against the rest. Needs two weeks and three stream days
  // before it says anything.
  const streamDays = new Set(streamDates.map((d) => d.slice(0, 10)));
  let multiplier: number | null = null;
  if (sorted.length >= 14 && streamDays.size >= 3) {
    const onDays: number[] = [];
    const offDays: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const delta = sorted[i].follower_count - sorted[i - 1].follower_count;
      (streamDays.has(dayKey(sorted[i].snapped_at)) ? onDays : offDays).push(delta);
    }
    if (onDays.length >= 2 && offDays.length >= 2) {
      const on = onDays.reduce((a, b) => a + b, 0) / onDays.length;
      const off = offDays.reduce((a, b) => a + b, 0) / offDays.length;
      if (off > 0) multiplier = Math.round((on / off) * 10) / 10;
    }
  }

  return (
    <div className="fw">
      <p className="hm-k">Followers</p>
      <p className="fw-row">
        <span className="fw-num">{current.toLocaleString("en-US")}</span>
        {deltaWeek !== null && (
          <span className="fw-delta" data-sign={deltaWeek > 0 ? "up" : deltaWeek < 0 ? "down" : undefined}>
            {deltaWeek > 0 ? `+${deltaWeek}` : deltaWeek < 0 ? `−${Math.abs(deltaWeek)}` : "±0"} this week
          </span>
        )}
      </p>
      {multiplier !== null && multiplier > 1.2 && (
        <p className="fw-note">
          You gain <b>{multiplier}x</b> more followers on days you stream.
        </p>
      )}
      {snapshots.length < 7 && <p className="fw-note">Still building up a week of data.</p>}
    </div>
  );
}
