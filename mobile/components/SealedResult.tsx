import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Lock } from 'lucide-react-native';
import { colors, fonts } from '@/lib/theme';
import { Button, Label, LabelRow, alpha } from '@/lib/ui';
import { openResult, type OpenReply } from '@/lib/api';
import { signed, untilText } from '@/lib/time';

/**
 * A sealed report and the moment it opens (the site's sealed-result.tsx).
 * The streamer calls it first, win or loss. Then a reel spins between WIN
 * and LOSS, lands on the real result, and the points pop. A placement
 * just reveals. A locked extra stream says when it opens, and that Pro
 * opens it now.
 */

type Phase = 'idle' | 'sending' | 'rolling' | 'landed' | 'error';

const STEPS = 14;
const ROW = 76;
const REEL_MS = 2100;

export function SealedResult({
  vodId,
  title,
  placement,
  locked,
  onOpened,
  onGoPro,
}: {
  vodId: string;
  /** Shown on the home card, where the stream isn't named yet. */
  title?: string | null;
  placement: boolean;
  locked: { opensAt: string } | null;
  /** After the reveal has played (or right away for a placement). */
  onOpened: (reply: OpenReply) => void;
  onGoPro: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [picked, setPicked] = useState<'win' | 'loss' | null>(null);
  const [reply, setReply] = useState<OpenReply | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, tick] = useState(0);
  const reel = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!locked) return;
    const t = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, [locked]);

  async function open(call: 'win' | 'loss' | null) {
    setPicked(call);
    setPhase('sending');
    setError(null);
    const { reply: r, error: err } = await openResult(vodId, call);
    if (!r) {
      setError(err);
      setPhase('error');
      return;
    }
    setReply(r);
    if (r.placement || r.delta == null) {
      onOpened(r);
      return;
    }
    setPhase('rolling');
    reel.setValue(0);
    Animated.timing(reel, {
      toValue: 1,
      duration: REEL_MS,
      easing: Easing.bezier(0.15, 0.6, 0.25, 1),
      useNativeDriver: true,
    }).start(() => {
      setPhase('landed');
      Animated.spring(pop, { toValue: 1, friction: 4, tension: 90, useNativeDriver: true }).start();
      setTimeout(() => onOpened(r), 2300);
    });
  }

  if (locked) {
    return (
      <View>
        <LabelRow
          left={
            <View style={s.lockRow}>
              <Lock size={12} color={colors.ink4} strokeWidth={2.2} />
              <Label>Sealed until Monday</Label>
            </View>
          }
          right={`Opens in ${untilText(locked.opensAt)}`}
        />
        {title ? <Text style={s.streamTitle} numberOfLines={2}>{title}</Text> : null}
        <Text style={s.title}>Your extra stream is in.</Text>
        <Text style={s.sub}>Free comes with 1 report a week, so this one stays sealed until Monday. Pro opens it now.</Text>
        <Button title="Open it now with Pro" onPress={onGoPro} style={{ marginTop: 18, alignSelf: 'flex-start' }} />
      </View>
    );
  }

  const won = reply?.delta != null && reply.delta > 0;
  const lost = reply?.delta != null && reply.delta < 0;
  const final = won ? 'Win' : lost ? 'Loss' : 'Held';
  const words = Array.from({ length: STEPS }, (_, i) =>
    i === STEPS - 1 ? final : (STEPS - 1 - i) % 2 === 1 ? (won ? 'Loss' : 'Win') : final
  );
  const tone = won ? colors.green : lost ? colors.danger : colors.ink;
  const callLine =
    reply?.call == null || (!won && !lost)
      ? null
      : (reply.call === 'win') === won
        ? 'Called it.'
        : `You called ${reply.call === 'win' ? 'a win' : 'a loss'}.`;

  return (
    <View>
      <LabelRow left={placement ? 'Your placement' : 'Result'} right="Sealed" />
      {title ? <Text style={s.streamTitle} numberOfLines={2}>{title}</Text> : null}

      {phase === 'rolling' || phase === 'landed' ? (
        <View style={s.verdict}>
          <View style={s.window}>
            <Animated.View
              style={{
                transform: [{ translateY: reel.interpolate({ inputRange: [0, 1], outputRange: [0, -(STEPS - 1) * ROW] }) }],
              }}
            >
              {words.map((w, i) => (
                <Text key={i} style={[s.reelWord, { color: i === STEPS - 1 ? tone : colors.ink3 }]}>
                  {w}
                </Text>
              ))}
            </Animated.View>
          </View>
          {phase === 'landed' && reply?.delta != null && (
            <Animated.Text
              style={[
                s.reelDelta,
                { color: tone, opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] },
              ]}
            >
              {signed(reply.delta)}
            </Animated.Text>
          )}
          {phase === 'landed' && callLine && (
            <Text style={[s.callLine, callLine === 'Called it.' && { color: colors.gold }]}>{callLine}</Text>
          )}
        </View>
      ) : placement ? (
        <>
          <Text style={s.title}>Your placement is in.</Text>
          <Text style={s.sub}>Your first report puts you on the ladder. See where you landed.</Text>
          <Button
            title={phase === 'sending' ? 'Opening...' : 'Reveal my rank'}
            onPress={() => open(null)}
            disabled={phase === 'sending'}
            style={{ marginTop: 18, alignSelf: 'flex-start' }}
          />
        </>
      ) : (
        <>
          <Text style={s.title}>Your result is in.</Text>
          <Text style={s.sub}>Call it before you open it. Did that stream win or lose?</Text>
          <View style={s.calls}>
            {(['win', 'loss'] as const).map((c) => {
              const hue = c === 'win' ? colors.green : colors.danger;
              const on = picked === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => open(c)}
                  disabled={phase === 'sending'}
                  style={({ pressed }) => [
                    s.call,
                    { borderColor: alpha(hue, on ? 0.9 : 0.45), backgroundColor: on ? alpha(hue, 0.12) : 'transparent' },
                    pressed && { backgroundColor: alpha(hue, 0.12) },
                  ]}
                >
                  <Text style={[s.callWord, { color: hue }]}>{c === 'win' ? 'Win' : 'Loss'}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable onPress={() => open(null)} disabled={phase === 'sending'} hitSlop={8} style={{ marginTop: 14, alignSelf: 'flex-start' }}>
            <Text style={s.skip}>{phase === 'sending' ? 'Opening...' : 'Just open it'}</Text>
          </Pressable>
        </>
      )}
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  streamTitle: { fontFamily: fonts.display, fontSize: 18, lineHeight: 24, letterSpacing: -0.3, color: colors.ink, marginBottom: 14 },
  title: { fontFamily: fonts.numbers, fontSize: 40, lineHeight: 42, textTransform: 'uppercase', color: colors.ink, marginTop: 4 },
  sub: { marginTop: 8, fontSize: 15, lineHeight: 22, color: colors.ink2 },
  calls: { flexDirection: 'row', gap: 12, marginTop: 20 },
  call: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 72, borderRadius: 12, borderWidth: 1 },
  callWord: { fontFamily: fonts.numbers, fontSize: 36, lineHeight: 40, textTransform: 'uppercase' },
  skip: { fontSize: 14, fontWeight: '600', color: colors.ink3, textDecorationLine: 'underline' },
  verdict: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginTop: 6 },
  window: { height: ROW, overflow: 'hidden' },
  reelWord: { height: ROW, fontFamily: fonts.numbers, fontSize: 76, lineHeight: ROW, textTransform: 'uppercase' },
  reelDelta: { fontFamily: fonts.numbers, fontSize: 48, lineHeight: 52 },
  callLine: { width: '100%', fontFamily: fonts.mono, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.ink3 },
  error: { marginTop: 12, fontSize: 14, color: colors.danger },
});
