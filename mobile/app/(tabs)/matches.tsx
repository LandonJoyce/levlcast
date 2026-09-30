import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';
import { Button, Hairline, Label, Loading, PageTitle, Screen, SectionHead } from '@/lib/ui';
import { RankPanel } from '@/components/RankPanel';
import { MatchRow } from '@/components/MatchRow';
import { buildMatchHistory, summarizeMatches, type MatchVodRow } from '@/lib/matches';
import { hasPaidPlan, isSealed, pointsBeforeSealed } from '@/lib/sealed';
import { clean, signed } from '@/lib/time';

/*
 * Every analyzed stream as a ranked game (the site's Matches page): the
 * rank, the record, what keeps coming back across streams, and all games.
 */

export default function MatchesScreen() {
  const router = useRouter();
  const [vods, setVods] = useState<MatchVodRow[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }
      const [vodsRes, profileRes] = await Promise.all([
        supabase
          .from('vods')
          .select('id, title, analyzed_at, stream_date, created_at, duration_seconds, rank_delta, rank_points_after, result_opened_at, result_call')
          .eq('user_id', user.id)
          .eq('status', 'ready'),
        supabase.from('profiles').select('rank_points, plan, subscription_expires_at, coaching_arc').eq('id', user.id).single(),
      ]);
      if (vodsRes.error) throw vodsRes.error;
      setVods((vodsRes.data ?? []) as MatchVodRow[]);
      setProfile(profileRes.data);
    } catch (err: any) {
      setError(err?.message || "Couldn't load your matches");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <Loading />;

  const matches = buildMatchHistory(vods);
  const summary = summarizeMatches(matches);
  const sealed = vods.filter((v) => isSealed({ ...v, status: 'ready' }));
  const opened = vods
    .filter((v) => !isSealed({ ...v, status: 'ready' }))
    .sort((a, b) => String(b.analyzed_at ?? '').localeCompare(String(a.analyzed_at ?? '')));
  const rankPoints = (profile?.rank_points as number | null) ?? null;
  const shownPoints = sealed.length ? pointsBeforeSealed(rankPoints, sealed) : rankPoints;
  const latestDelta = sealed.length ? null : (opened[0]?.rank_delta ?? null);
  const wins = opened
    .slice(0, 12)
    .map((v) => v.rank_delta)
    .filter((d): d is number => d !== null && d > 0 && d < 200);
  const avgWin = wins.length ? Math.round(wins.reduce((a, b) => a + b, 0) / wins.length) : null;

  const arc = hasPaidPlan(profile) ? (profile?.coaching_arc as Record<string, any> | null) : null;
  const recurring: string[] = Array.isArray(arc?.recurring_improvements) ? arc!.recurring_improvements : [];
  const improving: string[] = Array.isArray(arc?.improving_areas) ? arc!.improving_areas : [];
  const examples: string[][] = Array.isArray(arc?.recurring_examples) ? arc!.recurring_examples : [];

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <PageTitle>Matches</PageTitle>
      <Text style={s.sub}>Every analyzed stream is a ranked game. Beat your recent form and it&apos;s a win.</Text>
      {error ? <Text style={[s.sub, { color: colors.danger }]}>{error}</Text> : null}

      {matches.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyTitle}>No ranked games yet.</Text>
          <Text style={s.emptySub}>Your first analyzed stream is your placement. It puts you on the ladder.</Text>
          <Button title="Pick a stream" onPress={() => router.push('/(tabs)/vods')} style={{ alignSelf: 'flex-start' }} />
        </View>
      ) : (
        <>
          <Hairline style={{ marginTop: 20 }} />
          <RankPanel key={String(shownPoints)} points={shownPoints} delta={latestDelta} avgWin={avgWin} />
          <Hairline />

          {summary.games > 0 ? (
            <View style={s.stats}>
              <View style={s.stat}>
                <Label>Record</Label>
                <Text style={s.statN}>
                  {summary.wins}W {summary.losses}L
                </Text>
                <Text style={s.statSub}>last {summary.games} streams</Text>
              </View>
              <View style={s.stat}>
                <Label>Win rate</Label>
                <Text style={s.statN}>{summary.winRate === null ? '...' : `${summary.winRate}%`}</Text>
                <Text style={s.statSub}>wins vs losses</Text>
              </View>
              <View style={s.stat}>
                <Label>Net</Label>
                <Text style={[s.statN, { color: summary.net > 0 ? colors.green : summary.net < 0 ? colors.danger : colors.ink }]}>
                  {signed(summary.net)}
                </Text>
                <Text style={s.statSub}>rank points</Text>
              </View>
              <View style={[s.stat, { width: '100%' }]}>
                <Label>Form</Label>
                <View style={s.form}>
                  {summary.form.map((f, i) => (
                    <View
                      key={i}
                      style={[s.dot, { backgroundColor: f === 'win' ? colors.green : f === 'loss' ? colors.danger : colors.ink4 }]}
                    />
                  ))}
                </View>
                <Text style={s.statSub}>newest first</Text>
              </View>
            </View>
          ) : (
            <Text style={s.placed}>Placement done. Your next analyzed stream is your first ranked game.</Text>
          )}

          {(recurring.length > 0 || improving.length > 0 || arc?.synthesis) && (
            <View style={s.section}>
              <SectionHead title="Across your streams" meta={Array.isArray(arc?.score_history) ? `Last ${arc!.score_history.length}` : undefined} />
              {recurring.length > 0 && (
                <View style={{ marginBottom: 18 }}>
                  <Label color={colors.danger} style={{ marginBottom: 10 }}>Still working on</Label>
                  {recurring.map((item, i) => (
                    <View key={i} style={s.arcItem}>
                      <Text style={s.arcText}>{clean(item)}</Text>
                      {(examples[i] ?? []).length > 0 && (
                        <View style={s.try}>
                          <Label style={{ marginBottom: 4 }}>Try saying</Label>
                          {(examples[i] ?? []).map((ex, j) => (
                            <Text key={j} style={s.tryText}>{`“${ex}”`}</Text>
                          ))}
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
              {improving.length > 0 && (
                <View style={{ marginBottom: 18 }}>
                  <Label color={colors.green} style={{ marginBottom: 10 }}>Getting better</Label>
                  {improving.map((item, i) => (
                    <View key={i} style={s.arcItem}>
                      <Text style={s.arcText}>{clean(item)}</Text>
                    </View>
                  ))}
                </View>
              )}
              {arc?.synthesis ? <Text style={s.synth}>{clean(String(arc.synthesis))}</Text> : null}
            </View>
          )}

          <View style={s.section}>
            <SectionHead title="All games" meta={`${matches.length} total`} />
            <View style={{ borderTopWidth: 1, borderTopColor: colors.line }}>
              {matches.map((m) => (
                <MatchRow key={m.id} match={m} onPress={() => router.push(`/vod/${m.id}`)} />
              ))}
            </View>
          </View>
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  sub: { marginTop: 8, fontSize: 15, lineHeight: 22, color: colors.ink3 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 22, paddingVertical: 24 },
  stat: { width: '33.33%', gap: 6 },
  statN: { fontFamily: fonts.numbers, fontSize: 32, lineHeight: 34, color: colors.ink },
  statSub: { fontSize: 12, color: colors.ink4 },
  form: { flexDirection: 'row', gap: 6, paddingVertical: 6 },
  dot: { width: 14, height: 14, borderRadius: 3 },
  placed: { paddingVertical: 24, fontSize: 15, lineHeight: 22, color: colors.ink2 },
  section: { marginTop: 22 },
  arcItem: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.line },
  arcText: { fontSize: 15, lineHeight: 22, color: colors.ink2 },
  try: { marginTop: 10, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: colors.line2 },
  tryText: { fontSize: 14, lineHeight: 21, color: colors.ink },
  synth: { fontSize: 15, lineHeight: 23, color: colors.ink2 },
  empty: { marginTop: 24, paddingVertical: 28, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
  emptyTitle: { fontFamily: fonts.display, fontSize: 22, lineHeight: 29, letterSpacing: -0.4, color: colors.ink },
  emptySub: { marginTop: 8, marginBottom: 20, fontSize: 15, lineHeight: 22, color: colors.ink2 },
});
