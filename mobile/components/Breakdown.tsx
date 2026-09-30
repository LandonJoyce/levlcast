import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/lib/theme';
import { Label, Tag } from '@/lib/ui';
import { TIME_IN_TEXT, clean, clock, resolveStamp, secondsFromStamp, watchAt } from '@/lib/time';
import { PlayableText, WatchChip } from './Playable';

/**
 * The whole stream, shown more than told (the site's visual-breakdown.tsx):
 * each note is a card with its moment one tap away, the opening and ending
 * are drawn from how much you talked, the habits are your own words, and
 * the quiet stretches sit where they happened.
 */

type Tone = 'good' | 'flat' | 'bad';
const TONE_COLOR: Record<Tone, string> = { good: colors.green, flat: colors.warn, bad: colors.danger };

function splitItem(raw: string): { label: string | null; body: string } {
  const m = raw.trim().match(/^\*\*(.+?)\*\*[\s.:,—-]*([\s\S]*)$/);
  if (!m) return { label: null, body: clean(raw.replace(/\*\*/g, '')) };
  return { label: m[1].trim().replace(/[.:]$/, ''), body: clean(m[2]) };
}

const HABIT_NAMES: Record<string, string> = {
  viewer_count_apology: 'Apologizing for the viewer count',
  follow_begging: 'Asking for follows',
  lurker_shaming: 'Calling chat quiet',
  pre_stream_drain: 'Stalling at the start',
  self_defeat: 'Talking yourself down',
};
const habitName = (t: string) => HABIT_NAMES[t] ?? t.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

const START_WORD: Record<string, string> = { strong: 'Strong start', average: 'OK start', weak: 'Slow start' };
const END_WORD: Record<string, string> = { strong: 'Strong finish', average: 'OK finish', weak: 'Weak finish' };
const TONE: Record<string, Tone> = { strong: 'good', average: 'flat', weak: 'bad' };
const TALKING_WPM = 30;
const TREND_BAR_MAX = 90;

interface Ctx {
  vodId?: string | null;
  known: number[];
}

function firstTime(text: string, known: number[]): number | null {
  const m = text.match(TIME_IN_TEXT);
  return m ? resolveStamp(m[0], known) : null;
}

export interface TrendPoint {
  score: number;
  current?: boolean;
}

export function Breakdown({
  report,
  twitchVodId,
  durationSeconds,
  trajectory,
}: {
  report: Record<string, any>;
  twitchVodId?: string | null;
  durationSeconds?: number | null;
  /** Oldest first, this stream last. */
  trajectory?: TrendPoint[];
}) {
  const strengths = ((report.strengths ?? []) as string[]).filter(Boolean).map(splitItem);
  const improvements = ((report.improvements ?? []) as string[]).filter(Boolean).map(splitItem);
  const habits = (report.anti_patterns ?? []) as Array<{ type: string; time: string; quote: string; note: string }>;
  const rewatch = (report.rewatch_moments ?? []) as Array<{ time: string; kind: string; note: string }>;
  const deadZones = (report.dead_zones ?? []) as Array<{ time: string; duration: number }>;
  const words = Array.isArray(report.words_by_minute) ? (report.words_by_minute as number[]) : null;
  const duration = durationSeconds || (words ? words.length * 60 : 0);

  const known = [
    report.best_moment?.time,
    report.momentum_crash?.time,
    ...rewatch.map((r) => r.time),
    ...habits.map((a) => a.time),
    ...deadZones.map((z) => z.time),
  ]
    .filter((t): t is string => typeof t === 'string')
    .map(secondsFromStamp)
    .filter((t) => t >= 3600);
  const ctx: Ctx = { vodId: twitchVodId, known };

  return (
    <View style={{ gap: 30 }}>
      {report.stream_story ? (
        <PlayableText text={clean(report.stream_story)} vodId={twitchVodId} known={known} style={s.story} />
      ) : null}

      <Cards title="What worked" tone="good" items={strengths} ctx={ctx} />
      <Cards title="What to change" tone="bad" items={improvements} ctx={ctx} />

      {(report.cold_open?.note || report.closing?.note) && (
        <View>
          <Label style={s.k}>How it started and ended</Label>
          <View style={{ gap: 12 }}>
            {report.cold_open?.note ? (
              <Ends
                which="start"
                score={report.cold_open.score}
                note={report.cold_open.note}
                words={words}
                startSeconds={Number(report.stream_start_seconds ?? 0)}
                ctx={ctx}
              />
            ) : null}
            {report.closing?.note ? (
              <Ends which="end" score={report.closing.score} note={report.closing.note} words={words} startSeconds={0} ctx={ctx} />
            ) : null}
          </View>
        </View>
      )}

      {habits.length > 0 && (
        <View>
          <Label style={s.k}>Habits that cost you viewers</Label>
          <View style={{ gap: 12 }}>
            {habits.map((h, i) => (
              <View key={i} style={s.card}>
                <Text style={s.cardK}>{habitName(h.type)}</Text>
                <Text style={s.quote}>{`“${clean(h.quote)}”`}</Text>
                <PlayableText text={clean(h.note)} vodId={twitchVodId} known={known} style={s.cardB} />
                <WatchChip seconds={secondsFromStamp(h.time)} vodId={twitchVodId} label={habitName(h.type)} />
              </View>
            ))}
          </View>
        </View>
      )}

      {duration > 0 && deadZones.length > 0 && <Quiet zones={deadZones} duration={duration} total={report.dead_air_seconds} ctx={ctx} />}

      {rewatch.length > 0 && (
        <View>
          <Label style={s.k}>Worth rewatching</Label>
          <View style={{ gap: 12 }}>
            {rewatch.map((r, i) => {
              const tone: Tone = r.kind === 'best' ? 'good' : 'bad';
              return (
                <View key={i} style={[s.card, s.toned, { borderLeftColor: TONE_COLOR[tone] }]}>
                  <Text style={[s.cardK, { color: TONE_COLOR[tone] }]}>{r.kind === 'best' ? 'Do this again' : 'Watch this back'}</Text>
                  <PlayableText text={clean(r.note)} vodId={twitchVodId} known={known} style={s.cardB} still />
                  <WatchChip seconds={secondsFromStamp(r.time)} vodId={twitchVodId} />
                </View>
              );
            })}
          </View>
        </View>
      )}

      {trajectory && trajectory.length >= 2 && <Trend points={trajectory} note={report.trend_vs_history} />}

      {report.community_note ? (
        <View>
          <Label style={s.k}>Who this stream is for</Label>
          <Text style={s.line}>{clean(report.community_note)}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Cards({ title, tone, items, ctx }: { title: string; tone: Tone; items: Array<{ label: string | null; body: string }>; ctx: Ctx }) {
  if (items.length === 0) return null;
  return (
    <View>
      <Label style={s.k}>{title}</Label>
      <View style={{ gap: 12 }}>
        {items.map((it, i) => {
          const at = firstTime(it.body, ctx.known);
          return (
            <View key={i} style={[s.card, s.toned, { borderLeftColor: TONE_COLOR[tone] }]}>
              {it.label ? <Text style={s.cardTitle}>{it.label}</Text> : null}
              <PlayableText text={it.body} vodId={ctx.vodId} known={ctx.known} style={s.cardB} still={at !== null} />
              {at !== null && <WatchChip seconds={at} vodId={ctx.vodId} label={it.label ?? title} />}
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** The first or last ten minutes as talking bars, the first minute you really talked marked. */
function Ends({
  which,
  score,
  note,
  words,
  startSeconds,
  ctx,
}: {
  which: 'start' | 'end';
  score: string;
  note: string;
  words: number[] | null;
  startSeconds: number;
  ctx: Ctx;
}) {
  const WINDOW = 10;
  let bars: Array<{ minute: number; w: number }> = [];
  let firstTalk: number | null = null;
  if (words && words.length > 0) {
    const from = which === 'start' ? Math.min(words.length - 1, Math.floor(startSeconds / 60)) : Math.max(0, words.length - WINDOW);
    bars = words.slice(from, from + WINDOW).map((w, i) => ({ minute: from + i, w }));
    const talk = which === 'start' ? bars.find((b) => b.w >= TALKING_WPM)?.minute ?? null : null;
    firstTalk = talk !== null && talk > from ? talk : null;
  }
  const max = Math.max(60, ...bars.map((b) => b.w));
  const tone = TONE[score] ?? 'flat';
  const word = (which === 'start' ? START_WORD : END_WORD)[score] ?? (which === 'start' ? 'The start' : 'The finish');
  return (
    <View style={s.card}>
      <View style={s.endsHead}>
        <Text style={s.cardK}>{which === 'start' ? 'First 10 minutes' : 'Last 10 minutes'}</Text>
        <Tag text={word} color={TONE_COLOR[tone]} />
      </View>
      {bars.length > 0 && (
        <>
          <View style={s.bars}>
            {bars.map((b) => (
              <View
                key={b.minute}
                style={[
                  s.bar,
                  {
                    height: `${Math.max(4, (b.w / max) * 100)}%`,
                    backgroundColor: firstTalk === b.minute ? colors.ink : colors.ink4,
                    opacity: firstTalk === b.minute ? 1 : 0.55,
                  },
                ]}
              />
            ))}
          </View>
          <View style={s.axis}>
            <Text style={s.axisText}>{clock(bars[0].minute * 60)}</Text>
            {firstTalk !== null ? <Text style={[s.axisText, { color: colors.ink }]}>You got talking at {clock(firstTalk * 60)}</Text> : null}
            <Text style={s.axisText}>{clock((bars[bars.length - 1].minute + 1) * 60)}</Text>
          </View>
        </>
      )}
      <PlayableText text={clean(note)} vodId={ctx.vodId} known={ctx.known} style={s.cardB} />
      {firstTalk !== null && <WatchChip seconds={firstTalk * 60} vodId={ctx.vodId} label="Where you got talking" />}
    </View>
  );
}

/** The stream as a line with the quiet stretches where they happened. Tap one to watch it. */
function Quiet({ zones, duration, total, ctx }: { zones: Array<{ time: string; duration: number }>; duration: number; total?: number; ctx: Ctx }) {
  const spans = zones
    .map((z) => ({ start: secondsFromStamp(z.time), length: Math.max(0, Number(z.duration) || 0) }))
    .filter((z) => z.start < duration);
  if (spans.length === 0) return null;
  const quietSeconds = typeof total === 'number' ? total : spans.reduce((sum, z) => sum + z.length, 0);
  return (
    <View>
      <Label style={s.k}>Where it went quiet</Label>
      <View style={s.track}>
        {spans.map((z, i) => {
          const left = (z.start / duration) * 100;
          const width = Math.max(1.2, Math.min(100 - left, (z.length / duration) * 100));
          return (
            <Pressable
              key={i}
              onPress={() => watchAt(ctx.vodId, z.start)}
              disabled={!ctx.vodId}
              hitSlop={{ top: 12, bottom: 12, left: 4, right: 4 }}
              style={[s.span, { left: `${left}%`, width: `${width}%` }]}
              accessibilityLabel={`${Math.max(1, Math.round(z.length / 60))} quiet minutes at ${clock(z.start)}`}
            />
          );
        })}
      </View>
      <View style={s.axis}>
        <Text style={s.axisText}>0:00</Text>
        <Text style={s.axisText}>{clock(duration)}</Text>
      </View>
      <Text style={s.small}>
        {spans.length} quiet {spans.length === 1 ? 'stretch' : 'stretches'}, {Math.max(1, Math.round(quietSeconds / 60))} minutes
        {ctx.vodId ? '. Tap one to watch it.' : '.'}
      </Text>
    </View>
  );
}

/** Your recent scores as bars, oldest first, this stream lit. */
function Trend({ points, note }: { points: TrendPoint[]; note?: { direction: string; note: string } }) {
  const scores = points.map((p) => p.score);
  const top = Math.max(...scores);
  const floor = Math.max(0, Math.min(...scores) - 20);
  return (
    <View>
      <Label style={s.k}>Your last few streams</Label>
      <View style={s.trend}>
        {points.map((p, i) => (
          <View key={i} style={s.trendCol}>
            <Text style={[s.trendN, p.current && { color: colors.ink }]}>{p.score}</Text>
            <View
              style={[
                s.trendBar,
                {
                  height: Math.max(6, ((p.score - floor) / Math.max(1, top - floor)) * TREND_BAR_MAX),
                  backgroundColor: p.current ? colors.ink : colors.ink4,
                  opacity: p.current ? 1 : 0.45,
                },
              ]}
            />
          </View>
        ))}
      </View>
      <Text style={s.small}>Oldest on the left. This stream is the light bar.</Text>
      {note?.note && note.direction !== 'first_stream' ? <Text style={[s.line, { marginTop: 10 }]}>{clean(note.note)}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  k: { marginBottom: 12 },
  story: { fontSize: 16, lineHeight: 25, color: colors.ink2 },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  toned: { borderLeftWidth: 2 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  cardK: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.1, textTransform: 'uppercase', color: colors.ink3, marginBottom: 8 },
  cardB: { fontSize: 14.5, lineHeight: 21, color: colors.ink2 },
  quote: { fontFamily: fonts.display, fontSize: 17, lineHeight: 24, color: colors.ink, marginBottom: 8 },
  endsHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 64, marginBottom: 6 },
  bar: { flex: 1, borderRadius: 2 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, marginTop: 6 },
  axisText: { fontFamily: fonts.mono, fontSize: 10, color: colors.ink4 },
  track: { height: 18, borderRadius: 5, backgroundColor: colors.track, overflow: 'hidden' },
  span: { position: 'absolute', top: 0, bottom: 0, backgroundColor: colors.danger, borderRadius: 2 },
  small: { fontSize: 12.5, lineHeight: 18, color: colors.ink4 },
  line: { fontSize: 15, lineHeight: 22, color: colors.ink2 },
  trend: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 8 },
  trendCol: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  trendN: { fontFamily: fonts.mono, fontSize: 10, color: colors.ink4, marginBottom: 4 },
  trendBar: { width: '100%', borderRadius: 3 },
});
