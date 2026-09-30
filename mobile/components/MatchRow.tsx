import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { colors, fonts } from '@/lib/theme';
import { Tag, alpha } from '@/lib/ui';
import { EMBLEMS, TIER_HEX } from '@/lib/rank';
import { formatDate, formatDuration, signed } from '@/lib/time';
import type { Match, MatchTag } from '@/lib/matches';

/**
 * One analyzed stream as a ranked game: a coloured edge that says win or
 * loss before you read anything, the points, then the stream and the rank
 * it left you on. A sealed one shows none of it.
 */

const RESULT_LABEL: Record<string, string> = {
  win: 'Win',
  loss: 'Loss',
  held: 'Held',
  placement: 'Placed',
  unranked: 'Unranked',
};

const TAG_LABEL: Record<MatchTag, string> = {
  promoted: 'Promoted',
  demoted: 'Demoted',
  division_up: 'Division up',
  division_down: 'Division down',
  shield: 'Shield held',
};

function edgeColor(m: Match): string {
  if (m.sealed) return colors.gold;
  if (m.result === 'win') return colors.green;
  if (m.result === 'loss') return colors.danger;
  if (m.result === 'placement') return colors.ink;
  return colors.line2;
}

export function MatchRow({ match, onPress }: { match: Match; onPress: () => void }) {
  const c = edgeColor(match);
  const tint = match.result === 'unranked' && !match.sealed ? 'transparent' : alpha(c.startsWith('#') ? c : '#FFFAF7', 0.05);

  if (match.sealed) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [s.row, { borderLeftColor: c, backgroundColor: pressed ? alpha(c, 0.1) : tint }]}>
        <View style={s.result}>
          <Text style={[s.resultLabel, { color: c }]}>Sealed</Text>
        </View>
        <View style={s.main}>
          <Text style={s.title} numberOfLines={1}>{match.title || 'Untitled stream'}</Text>
          <Text style={s.meta} numberOfLines={1}>
            {formatDate(match.at)} {'·'} Call it before you open it
          </Text>
        </View>
        <ChevronRight size={16} color={colors.ink4} />
      </Pressable>
    );
  }

  const tierColor = match.rank ? TIER_HEX[match.rank.tier] : undefined;
  const tagColor =
    match.tag === 'promoted' || match.tag === 'division_up'
      ? colors.green
      : match.tag === 'demoted' || match.tag === 'division_down'
        ? colors.danger
        : colors.ink2;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.row, { borderLeftColor: c, backgroundColor: pressed ? alpha(c.startsWith('#') ? c : '#FFFAF7', 0.1) : tint }]}>
      <View style={s.result}>
        <Text style={[s.resultLabel, { color: match.result === 'unranked' ? colors.ink3 : c }]}>{RESULT_LABEL[match.result]}</Text>
        {match.delta !== null && <Text style={[s.delta, { color: c }]}>{signed(match.delta)}</Text>}
      </View>
      <View style={s.main}>
        <Text style={s.title} numberOfLines={1}>{match.title || 'Untitled stream'}</Text>
        <View style={s.metaRow}>
          {match.rank && <Image source={EMBLEMS[match.rank.tier]} style={s.emblem} resizeMode="contain" />}
          <Text style={s.meta} numberOfLines={1}>
            {match.rank ? <Text style={{ color: tierColor }}>{match.rank.label}</Text> : null}
            {match.rank ? ` · ` : ''}
            {formatDate(match.at)}
            {match.durationSeconds ? ` · ${formatDuration(match.durationSeconds)}` : ''}
          </Text>
        </View>
        {(match.call === 'called' || match.tag) && (
          <View style={s.tags}>
            {match.call === 'called' && <Tag text="Called it" color={colors.gold} />}
            {match.tag && <Tag text={TAG_LABEL[match.tag]} color={tagColor} />}
          </View>
        )}
      </View>
      <ChevronRight size={16} color={colors.ink4} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 10,
    borderLeftWidth: 3,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  result: { width: 56, gap: 3 },
  resultLabel: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' },
  delta: { fontFamily: fonts.numbers, fontSize: 24, lineHeight: 26 },
  main: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: '500', color: colors.ink },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  emblem: { width: 16, height: 16 },
  meta: { flexShrink: 1, fontFamily: fonts.mono, fontSize: 11, color: colors.ink3 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 7 },
});
