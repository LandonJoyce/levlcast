import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ArrowUpRight, Film, Play } from 'lucide-react-native';
import { colors, fonts } from '@/lib/theme';
import { Button } from '@/lib/ui';
import { clock, watchAt } from '@/lib/time';

export interface Peak {
  title: string;
  start: number;
  end: number;
  score?: number;
  category?: string;
  reason?: string;
  hook?: string;
}

export function categoryLabel(c: string | null | undefined): string {
  if (!c) return '';
  if (c === 'funny') return 'Comedy';
  if (c === 'clutch_play') return 'Clutch';
  return c.charAt(0).toUpperCase() + c.slice(1).replace(/_/g, ' ');
}

/**
 * A moment worth clipping: its time (tap to watch it on Twitch), what
 * happened, and making the clip.
 */
export function MomentRow({
  peak,
  twitchVodId,
  clipState,
  onMake,
  onOpenClip,
  busy,
  disabled,
  missed,
}: {
  peak: Peak;
  twitchVodId?: string | null;
  clipState?: 'ready' | 'processing' | null;
  onMake?: () => void;
  onOpenClip?: () => void;
  busy?: boolean;
  disabled?: boolean;
  /** "Almost a clip": no button, warm title. */
  missed?: boolean;
}) {
  const start = Number(peak.start) || 0;
  return (
    <View style={s.moment}>
      <Pressable
        onPress={() => watchAt(twitchVodId, start)}
        disabled={!twitchVodId}
        hitSlop={8}
        style={s.timeCell}
        accessibilityLabel={`Watch ${peak.title} at ${clock(start)}`}
      >
        {twitchVodId ? <Play size={9} color={colors.ink} fill={colors.ink} /> : null}
        <Text style={[s.time, !twitchVodId && { color: colors.ink3, textDecorationLine: 'none' }]}>{clock(start)}</Text>
      </Pressable>
      <View style={s.main}>
        <Text style={[s.title, missed && { color: colors.warn }]}>
          {peak.title}
          {peak.category ? <Text style={s.cat}>{'  '}{categoryLabel(peak.category)}</Text> : null}
        </Text>
        {peak.reason ? <Text style={s.why}>{peak.reason}</Text> : null}
        {peak.hook ? <Text style={s.hook}>Hook: {peak.hook}</Text> : null}
        {!missed && (
          <View style={s.act}>
            {clipState === 'ready' ? (
              <Pressable onPress={onOpenClip} hitSlop={8}>
                <Text style={s.done}>Clip made {'→'}</Text>
              </Pressable>
            ) : clipState === 'processing' ? (
              <Text style={s.busy}>Making the clip...</Text>
            ) : onMake ? (
              <Button title="Make clip" kind="ghost" small onPress={onMake} loading={busy} disabled={disabled} style={{ alignSelf: 'flex-start' }} />
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
}

export interface ClipRow {
  id: string;
  title: string | null;
  status: string;
  video_url: string | null;
  thumbnail_url: string | null;
  start_time_seconds: number | null;
  end_time_seconds: number | null;
  is_highlight_reel: boolean | null;
  peak_category: string | null;
  vod_id: string;
  caption_text?: string | null;
  failed_reason?: string | null;
}

/** A made clip as a 9:16 card. */
export function ClipCard({
  clip,
  from,
  postedUrl,
  onPress,
  onOpenPosted,
}: {
  clip: ClipRow;
  from?: string | null;
  postedUrl?: string | null;
  onPress: () => void;
  onOpenPosted?: () => void;
}) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.floor((Math.min(width, 520) - 40 - 12) / 2);
  const making = clip.status === 'processing';
  const length =
    typeof clip.end_time_seconds === 'number' && typeof clip.start_time_seconds === 'number'
      ? clock(clip.end_time_seconds - clip.start_time_seconds)
      : null;
  return (
    <View style={{ width: cardWidth }}>
      <Pressable
        onPress={onPress}
        disabled={making}
        style={({ pressed }) => [s.thumb, { width: cardWidth, height: Math.round((cardWidth * 16) / 9) }, pressed && { borderColor: colors.ink3 }, postedUrl ? { opacity: 0.6 } : null]}
      >
        {making ? (
          <View style={s.making}>
            <ActivityIndicator size="small" color={colors.ink3} />
            <Text style={s.makingText}>Making it</Text>
          </View>
        ) : clip.thumbnail_url ? (
          <Image source={{ uri: clip.thumbnail_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <Film size={22} color={colors.ink4} />
        )}
        {!making && length ? <Text style={[s.badge, { right: 8 }]}>{length}</Text> : null}
        {!making && clip.is_highlight_reel ? <Text style={[s.badge, { left: 8, letterSpacing: 1 }]}>REEL</Text> : null}
      </Pressable>
      <Text style={s.cardTitle} numberOfLines={2}>
        {clip.title || (clip.is_highlight_reel ? 'Highlight reel' : 'Untitled clip')}
      </Text>
      {making ? (
        <Text style={s.from} numberOfLines={1}>Takes a minute or two</Text>
      ) : from || clip.peak_category ? (
        <Text style={s.from} numberOfLines={1}>
          {[categoryLabel(clip.peak_category), from].filter(Boolean).join(' · ')}
        </Text>
      ) : null}
      {postedUrl ? (
        <Pressable onPress={onOpenPosted} hitSlop={6} style={s.posted}>
          <Text style={s.postedText}>On YouTube</Text>
          <ArrowUpRight size={12} color={colors.green} />
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  moment: { flexDirection: 'row', gap: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.line },
  timeCell: { width: 62, flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingTop: 2 },
  time: { fontFamily: fonts.mono, fontSize: 12, color: colors.ink, textDecorationLine: 'underline' },
  main: { flex: 1, minWidth: 0 },
  title: { fontSize: 14.5, fontWeight: '600', lineHeight: 20, color: colors.ink },
  cat: { fontFamily: fonts.mono, fontSize: 10.5, letterSpacing: 1, textTransform: 'uppercase', color: colors.ink4 },
  why: { marginTop: 4, fontSize: 13.5, lineHeight: 20, color: colors.ink3 },
  hook: { marginTop: 4, fontSize: 13, lineHeight: 19, color: colors.ink2 },
  act: { marginTop: 10 },
  done: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: colors.green },
  busy: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.ink3 },
  thumb: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#1A1516',
  },
  making: { alignItems: 'center', gap: 8 },
  makingText: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: colors.ink3 },
  badge: {
    position: 'absolute',
    bottom: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: 'rgba(8,6,7,0.72)',
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.ink,
  },
  cardTitle: { marginTop: 10, fontSize: 14, fontWeight: '600', lineHeight: 19, color: colors.ink },
  from: { marginTop: 4, fontSize: 12.5, color: colors.ink3 },
  posted: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  postedText: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.green },
});
