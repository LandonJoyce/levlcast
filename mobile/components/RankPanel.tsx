import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/lib/theme';
import { Label, Tag } from '@/lib/ui';
import { DIVISION_SIZE, EMBLEMS, TIER_HEX, nextDivision, rankFromPoints, winsAway } from '@/lib/rank';
import { signed } from '@/lib/time';

/**
 * The rank, played back each visit like the site's rank panel: the points
 * count up from where they were before the last stream and the bar fills
 * by what it earned.
 */
export function RankPanel({
  points,
  delta,
  avgWin = null,
  label = 'Your rank',
}: {
  points: number | null;
  delta: number | null;
  avgWin?: number | null;
  label?: string;
}) {
  const rank = points === null ? null : rankFromPoints(points);
  // Placements record the whole starting rating as their delta.
  const gain = delta !== null && Math.abs(delta) < 200 ? delta : 0;
  const before = points === null ? null : rankFromPoints(points - gain);
  const placed = delta !== null && Math.abs(delta) >= 200;
  const promoted = !!(rank && before && gain > 0 && before.label !== rank.label);
  const demoted = !!(rank && before && gain < 0 && before.label !== rank.label);

  const startFill = !rank || gain === 0 ? rank?.progress ?? 0 : promoted ? 0 : before && before.label === rank.label ? before.progress : 0;
  const [shown, setShown] = useState(points === null ? 0 : points - gain);
  const fill = useRef(new Animated.Value(startFill)).current;
  const land = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!rank || points === null) return;
    Animated.spring(land, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }).start();
    if (gain === 0) {
      setShown(points);
      fill.setValue(rank.progress);
      return;
    }
    setShown(points - gain);
    fill.setValue(startFill);
    Animated.timing(fill, {
      toValue: rank.progress,
      duration: 900,
      delay: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    const t0 = Date.now() + 350;
    const timer = setInterval(() => {
      const k = Math.min(1, Math.max(0, (Date.now() - t0) / 900));
      const ease = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(points - gain + gain * ease));
      if (k >= 1) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  if (!rank || points === null) {
    return (
      <View style={s.wrap}>
        <Label style={{ marginBottom: 12 }}>{label}</Label>
        <Text style={[s.tier, { color: colors.ink3 }]}>Unranked</Text>
        <Text style={[s.note, { lineHeight: 18, marginTop: 12 }]}>Analyze a stream and your first report places you on the ladder.</Text>
      </View>
    );
  }

  const color = TIER_HEX[rank.tier] ?? colors.ink;
  const next = nextDivision(rank);
  const toNext = rank.division === null ? null : DIVISION_SIZE - (points % DIVISION_SIZE);
  const away = toNext !== null ? winsAway(toNext, avgWin) : null;

  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <Label>{label}</Label>
        {placed && <Tag text="Placed" color={colors.gold} />}
        {promoted && <Tag text="Promoted" color={colors.gold} />}
        {demoted && <Tag text="Dropped a division" color={colors.danger} />}
      </View>
      <View style={s.main}>
        <Animated.Image
          source={EMBLEMS[rank.tier]}
          style={[
            s.emblem,
            {
              opacity: land,
              transform: [{ scale: land.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
            },
          ]}
          resizeMode="contain"
        />
        <View style={s.body}>
          <Text style={[s.tier, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {rank.label}
          </Text>
          <View style={s.points}>
            <Text style={s.num}>{shown.toLocaleString('en-US')}</Text>
            <Text style={s.pointsWord}>points</Text>
            {gain !== 0 && <Text style={[s.delta, { color: gain > 0 ? colors.green : colors.danger }]}>{signed(gain)}</Text>}
          </View>
        </View>
      </View>
      <View style={s.bar}>
        <Animated.View
          style={[
            s.barFill,
            { backgroundColor: color, width: fill.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) },
          ]}
        />
      </View>
      <Text style={s.note}>
        {next && toNext !== null ? (
          <>
            {toNext} points to {next}
            {away ? <Text style={{ color: colors.ink }}> {'·'} {away}</Text> : null}
          </>
        ) : next ? (
          `${rank.progress}% of the way to ${next}`
        ) : (
          'Top of the ladder'
        )}
      </Text>
    </View>
  );
}

/** A small emblem with the rank name, for rows. */
export function RankChip({ points }: { points: number }) {
  const rank = rankFromPoints(points);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Image source={EMBLEMS[rank.tier]} style={{ width: 22, height: 22 }} resizeMode="contain" />
      <Text style={{ fontSize: 13, fontWeight: '700', color: TIER_HEX[rank.tier] ?? colors.ink2 }}>{rank.label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingVertical: 24 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 20, marginBottom: 14 },
  main: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  emblem: { width: 96, height: 96 },
  body: { flex: 1, minWidth: 0 },
  tier: { fontFamily: fonts.numbers, fontSize: 50, lineHeight: 50, letterSpacing: 0.5, textTransform: 'uppercase' },
  points: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  num: { fontFamily: fonts.numbers, fontSize: 28, lineHeight: 30, color: colors.ink },
  pointsWord: { fontSize: 14, color: colors.ink3 },
  delta: { fontFamily: fonts.mono, fontSize: 13 },
  bar: { height: 8, marginTop: 20, borderRadius: 4, backgroundColor: colors.track, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  note: { marginTop: 10, fontFamily: fonts.mono, fontSize: 11, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.ink3 },
});
