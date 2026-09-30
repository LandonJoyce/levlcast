import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/lib/theme';
import { Bar, Label, LabelRow } from '@/lib/ui';
import { estimateAnalysis, type AnalysisInput } from '@/lib/progress';

/** Ticks once a second while a report is being made. */
function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

function leftText(fraction: number, totalMinutes: number, slow: boolean): string {
  if (slow) return 'Taking longer than usual';
  const left = Math.max(1, Math.ceil(totalMinutes * (1 - fraction)));
  return left <= 1 ? 'About a minute left' : `About ${left} min left`;
}

/** The small bar for rows: a line and how long is left. */
export function AnalysisBar({ input }: { input: AnalysisInput }) {
  const now = useNow(true);
  const e = estimateAnalysis(input, now);
  return (
    <View style={{ width: 118 }}>
      <Bar fraction={e.fraction} height={4} />
      <Text style={s.small}>{leftText(e.fraction, e.totalMinutes, e.slow)}</Text>
    </View>
  );
}

/** The big one for the stream page, with the percent. */
export function AnalysisProgressCard({ input, firstPartOnly, first }: { input: AnalysisInput; firstPartOnly: boolean; first: boolean }) {
  const now = useNow(true);
  const e = estimateAnalysis(input, now);
  const pct = Math.round(e.fraction * 100);
  return (
    <View style={s.card}>
      <LabelRow left={first ? 'Your first report' : 'Making your report'} right={leftText(e.fraction, e.totalMinutes, e.slow)} />
      <View style={s.pctRow}>
        <Text style={s.pct}>{pct}</Text>
        <Text style={s.pctSign}>%</Text>
      </View>
      <Bar fraction={e.fraction} height={8} />
      <Label style={{ marginTop: 12 }}>{e.phase === 'writing' ? 'Reading chat and writing the report' : 'Listening to the stream'}</Label>
      <Text style={s.body}>
        {firstPartOnly
          ? 'A free report coaches the first 2 hours of a stream. '
          : ''}
        It keeps going if you close the app.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  small: { marginTop: 6, fontFamily: fonts.mono, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.ink3 },
  card: { paddingVertical: 24, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
  pctRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 14 },
  pct: { fontFamily: fonts.numbers, fontSize: 88, lineHeight: 84, color: colors.ink },
  pctSign: { fontFamily: fonts.numbers, fontSize: 36, lineHeight: 40, color: colors.ink3, marginLeft: 4 },
  body: { marginTop: 10, fontSize: 14, lineHeight: 21, color: colors.ink3 },
});
