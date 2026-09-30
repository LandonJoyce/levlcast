import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/lib/theme';
import { Label, LabelRow, Tag } from '@/lib/ui';
import { signed } from '@/lib/time';

/**
 * Where the points went: four bars, the one costing the most marked
 * (the site's stream-scorecard.tsx). No letter grades.
 */

export interface Subscores {
  energy?: number;
  engagement?: number;
  consistency?: number;
  content?: number;
}

const METRICS: Array<{ key: keyof Subscores; label: string; blurb: string }> = [
  { key: 'energy', label: 'Energy', blurb: 'How you sounded. Pace, volume, life.' },
  { key: 'engagement', label: 'Engagement', blurb: 'Talking to chat and reacting out loud.' },
  { key: 'consistency', label: 'Consistency', blurb: 'Holding it together instead of going flat.' },
  { key: 'content', label: 'Content', blurb: "Having something to say about what's happening." },
];

function FillBar({ value, worst }: { value: number; worst: boolean }) {
  const w = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(w, {
      toValue: Math.max(2, Math.min(100, value)),
      duration: 850,
      delay: 180,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: false,
    }).start();
  }, [value, w]);
  return (
    <View style={s.bar}>
      <Animated.View
        style={[
          s.fill,
          { backgroundColor: worst ? colors.danger : colors.ink3, width: w.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) },
        ]}
      />
    </View>
  );
}

export function Scorecard({
  scores,
  previousScores,
  deadAirPct,
}: {
  scores: Subscores | null | undefined;
  previousScores?: Subscores | null;
  deadAirPct?: number | null;
}) {
  const rows = METRICS.map((m) => {
    const value = typeof scores?.[m.key] === 'number' ? (scores[m.key] as number) : null;
    const prev = typeof previousScores?.[m.key] === 'number' ? (previousScores[m.key] as number) : null;
    return { ...m, value, delta: value !== null && prev !== null ? value - prev : null };
  }).filter((r) => r.value !== null);
  if (rows.length === 0) return null;
  const worst = rows.reduce((lo, r) => ((r.value as number) < (lo.value as number) ? r : lo));

  return (
    <View>
      <LabelRow
        left="Where the points went"
        right={
          typeof deadAirPct === 'number' && deadAirPct > 0 ? (
            <Label color={deadAirPct >= 25 ? colors.danger : undefined}>{Math.round(deadAirPct)}% silence</Label>
          ) : undefined
        }
      />
      <View style={{ gap: 16, marginTop: 4 }}>
        {rows.map((r) => {
          const isWorst = rows.length > 1 && r.key === worst.key;
          return (
            <View key={r.key}>
              <View style={s.line}>
                <View style={s.labelWrap}>
                  <Text style={s.label}>{r.label}</Text>
                  {isWorst && <Tag text="Costing you most" color={colors.danger} />}
                </View>
                {r.delta !== null && r.delta !== 0 && (
                  <Text style={[s.delta, { color: r.delta > 0 ? colors.green : colors.danger }]}>{signed(r.delta)}</Text>
                )}
                <Text style={s.val}>{r.value}</Text>
              </View>
              <FillBar value={r.value as number} worst={isWorst} />
              <Text style={s.blurb}>{r.blurb}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 7 },
  labelWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  label: { fontSize: 14, fontWeight: '600', color: colors.ink },
  delta: { fontFamily: fonts.mono, fontSize: 12 },
  val: { minWidth: 28, textAlign: 'right', fontFamily: fonts.numbers, fontSize: 22, lineHeight: 24, color: colors.ink },
  bar: { height: 6, borderRadius: 3, backgroundColor: colors.track, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  blurb: { marginTop: 6, fontSize: 12.5, color: colors.ink4 },
});
