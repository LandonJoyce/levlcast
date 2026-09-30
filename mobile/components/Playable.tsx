import { Pressable, StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { Play } from 'lucide-react-native';
import { colors, fonts } from '@/lib/theme';
import { TIME_IN_TEXT, clock, resolveStamp, watchAt } from '@/lib/time';

/**
 * Coach text with its times ("0:42", "1:42:10") as moments you can tap.
 * A tap opens the past broadcast on Twitch at that moment.
 */
export function PlayableText({
  text,
  vodId,
  known = [],
  style,
  still = false,
}: {
  text: string;
  vodId?: string | null;
  /** Exact times from elsewhere in the report, so "at 1:42" plays 1:42:10. */
  known?: number[];
  style?: StyleProp<TextStyle>;
  /** Just set the times apart; a chip beside the text plays them. */
  still?: boolean;
}) {
  const parts = text.split(new RegExp(`(${TIME_IN_TEXT.source})`, 'g'));
  const isTime = new RegExp(`^${TIME_IN_TEXT.source}$`);
  return (
    <Text style={style}>
      {parts.map((p, i) => {
        if (!isTime.test(p)) return p;
        const seconds = resolveStamp(p, known);
        return vodId && !still ? (
          <Text key={i} style={s.time} onPress={() => watchAt(vodId, seconds)} suppressHighlighting={false}>
            {clock(seconds)}
          </Text>
        ) : (
          <Text key={i} style={s.still}>
            {clock(seconds)}
          </Text>
        );
      })}
    </Text>
  );
}

/** "▶ 1:42:10": plays a moment. */
export function WatchChip({ seconds, vodId, label }: { seconds: number; vodId?: string | null; label?: string }) {
  if (!vodId) {
    return <Text style={[s.chipText, { color: colors.ink3, marginTop: 10 }]}>{clock(seconds)}</Text>;
  }
  return (
    <Pressable
      onPress={() => watchAt(vodId, seconds)}
      accessibilityLabel={label ? `Watch ${label} at ${clock(seconds)}` : `Watch ${clock(seconds)}`}
      hitSlop={6}
      style={({ pressed }) => [s.chip, pressed && { backgroundColor: colors.wash }]}
    >
      <Play size={10} color={colors.ink} fill={colors.ink} />
      <Text style={s.chipText}>{clock(seconds)}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  time: { fontFamily: fonts.mono, fontSize: 13, color: colors.ink, textDecorationLine: 'underline' },
  still: { fontFamily: fonts.mono, fontSize: 13, color: colors.ink },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line2,
  },
  chipText: { fontFamily: fonts.mono, fontSize: 12, color: colors.ink },
});
