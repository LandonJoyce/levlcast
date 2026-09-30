import { useCallback, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { ChevronRight } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';
import { Button, Loading, PageTitle, Screen, Tag } from '@/lib/ui';
import { AnalysisBar } from '@/components/AnalysisBar';
import { isPlacementDelta } from '@/lib/rank';
import { hasPaidPlan, isLocked, isSealed } from '@/lib/sealed';
import { coachedSeconds } from '@/lib/progress';
import { clean, formatDate, formatDuration, signed } from '@/lib/time';
import { startReport, syncStreams } from '@/lib/api';

/*
 * Every stream synced from Twitch, newest first, one row each: when it
 * was, how it went, and the coach's one line (the site's Streams page).
 */

const TABS = [
  ['all', 'All'],
  ['ready', 'Analyzed'],
  ['pending', 'Not analyzed'],
] as const;
type TabKey = (typeof TABS)[number][0];

/** The most concrete true line in the report. */
function streamLine(report: Record<string, any> | null): string | null {
  if (!report) return null;
  const punch = typeof report.punch_line === 'string' ? report.punch_line.trim() : '';
  if (punch) return clean(punch);
  const rec = typeof report.recommendation === 'string' ? report.recommendation.trim() : '';
  if (rec) return clean(rec.match(/^[\s\S]*?[.!?](?=\s|$)/)?.[0] ?? rec);
  const improvements = Array.isArray(report.improvements) ? report.improvements : [];
  const first = improvements.find((x: unknown): x is string => typeof x === 'string' && x.length > 0);
  return first ? clean(first.replace(/\*\*/g, '')) : null;
}

const isRunning = (s: string) => s === 'transcribing' || s === 'analyzing';

export default function StreamsScreen() {
  const router = useRouter();
  const [vods, setVods] = useState<any[]>([]);
  const [clipCount, setClipCount] = useState<Map<string, number>>(new Map());
  const [isPro, setIsPro] = useState(false);
  const [tab, setTab] = useState<TabKey>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const goPro = useCallback(() => router.push('/subscribe'), [router]);

  const load = useCallback(async () => {
    try {
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }
      const [vodsRes, clipsRes, profileRes] = await Promise.all([
        supabase
          .from('vods')
          .select(
            'id, title, duration_seconds, status, stream_date, created_at, updated_at, progress, coach_report, thumbnail_url, failed_reason, rank_delta, rank_points_after, result_opened_at, sealed_extra_week'
          )
          .eq('user_id', user.id)
          .order('stream_date', { ascending: false }),
        supabase.from('clips').select('vod_id').eq('user_id', user.id).eq('status', 'ready'),
        supabase.from('profiles').select('plan, subscription_expires_at').eq('id', user.id).single(),
      ]);
      if (vodsRes.error) throw vodsRes.error;
      const counts = new Map<string, number>();
      for (const c of clipsRes.data ?? []) counts.set(c.vod_id, (counts.get(c.vod_id) ?? 0) + 1);
      setVods(vodsRes.data ?? []);
      setClipCount(counts);
      setIsPro(hasPaidPlan(profileRes.data));
    } catch (err: any) {
      setError(err?.message || "Couldn't load your streams");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const hasRunning = vods.some((v) => isRunning(v.status));
  useFocusEffect(
    useCallback(() => {
      if (!hasRunning) return;
      const t = setInterval(load, 10000);
      return () => clearInterval(t);
    }, [hasRunning, load])
  );

  async function sync() {
    setSyncing(true);
    const r = await syncStreams();
    setSyncing(false);
    if (r?.synced === 0 && r?.total === 0 && r?.message) Alert.alert('No past broadcasts yet', r.message);
    load();
  }

  async function analyze(id: string) {
    setStarting(id);
    const started = await startReport(id, goPro);
    setStarting(null);
    if (started) load();
  }

  if (loading) return <Loading />;

  const analyzed = vods.filter((v) => v.status === 'ready').length;
  const notAnalyzed = vods.filter((v) => v.status === 'pending' || v.status === 'failed').length;
  const shown = vods.filter((v) => {
    if (tab === 'ready') return v.status === 'ready';
    if (tab === 'pending') return v.status === 'pending' || v.status === 'failed' || isRunning(v.status);
    return true;
  });

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={s.hello}>
        <View style={{ flex: 1 }}>
          <PageTitle>Streams</PageTitle>
          {vods.length > 0 && (
            <Text style={s.sum}>
              {analyzed} analyzed {'·'} {notAnalyzed} not analyzed
            </Text>
          )}
        </View>
        {vods.length > 0 && <Button title="Sync" kind="ghost" small onPress={sync} loading={syncing} />}
      </View>

      {error ? <Text style={[s.none, { color: colors.danger }]}>{error}</Text> : null}

      {vods.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyTitle}>Pull in your streams to get started.</Text>
          <View style={s.steps}>
            <Text style={s.step}>1. Sync your last 20 Twitch streams.</Text>
            <Text style={s.step}>2. Press Analyze on one.</Text>
            <Text style={s.step}>3. Get your report, your rank and your clips.</Text>
          </View>
          <Button title="Sync my streams" onPress={sync} loading={syncing} style={{ alignSelf: 'flex-start' }} />
        </View>
      ) : (
        <>
          <View style={s.tabs}>
            {TABS.map(([k, label]) => (
              <Pressable key={k} onPress={() => setTab(k)} hitSlop={6} style={[s.tab, tab === k && s.tabOn]}>
                <Text style={[s.tabText, tab === k && { color: colors.ink }]}>{label}</Text>
              </Pressable>
            ))}
          </View>

          {shown.length === 0 ? (
            <Text style={s.none}>Nothing here.</Text>
          ) : (
            shown.map((v) => {
              const ready = v.status === 'ready';
              const sealed = ready && isSealed(v);
              const locked = sealed && isLocked(v, isPro);
              const running = isRunning(v.status);
              const failed = v.status === 'failed';
              const line = ready && !sealed ? streamLine(v.coach_report) : null;
              const delta = (v.rank_delta as number | null) ?? null;
              const placed = delta !== null && isPlacementDelta(delta);
              const made = clipCount.get(v.id) ?? 0;
              const thumb = v.thumbnail_url ? String(v.thumbnail_url).replace('%{width}', '320').replace('%{height}', '180') : null;
              const open = () => router.push(`/vod/${v.id}`);
              const tone = placed || delta === null ? colors.ink2 : delta >= 0 ? colors.green : colors.danger;

              return (
                <Pressable key={v.id} onPress={open} style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.wash }]}>
                  <View style={s.thumb}>{thumb ? <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}</View>
                  <View style={s.main}>
                    <Text style={s.title} numberOfLines={2}>{v.title || 'Untitled stream'}</Text>
                    <Text style={s.meta} numberOfLines={1}>
                      {formatDate(v.stream_date ?? v.created_at)}
                      {v.duration_seconds ? ` · ${formatDuration(v.duration_seconds)}` : ''}
                      {made > 0 ? ` · ${made} ${made === 1 ? 'clip' : 'clips'}` : ''}
                    </Text>
                    {line ? <Text style={s.line} numberOfLines={2}>{line}</Text> : null}
                    {failed ? <Text style={s.failed} numberOfLines={2}>{v.failed_reason || "The analysis didn't finish."}</Text> : null}

                    <View style={s.end}>
                      {sealed ? (
                        <View style={s.res}>
                          <Text style={[s.resWord, { color: colors.gold }]}>{locked ? 'Sealed until Monday' : 'Sealed'}</Text>
                          <ChevronRight size={16} color={colors.ink4} />
                        </View>
                      ) : ready ? (
                        <View style={s.res}>
                          {placed ? (
                            <Text style={[s.resWord, { color: tone }]}>Placed</Text>
                          ) : delta !== null ? (
                            <>
                              <Text style={[s.resWord, { color: tone }]}>{delta >= 0 ? 'Win' : 'Loss'}</Text>
                              <Text style={[s.resNum, { color: tone }]}>{signed(delta)}</Text>
                            </>
                          ) : (
                            <Text style={[s.resWord, { color: tone }]}>Report</Text>
                          )}
                          <ChevronRight size={16} color={colors.ink4} />
                        </View>
                      ) : running ? (
                        <AnalysisBar
                          input={{
                            status: v.status,
                            durationSeconds: coachedSeconds(v.duration_seconds, isPro),
                            updatedAt: v.updated_at ?? null,
                            progress: v.progress ?? null,
                          }}
                        />
                      ) : (
                        <View style={s.analyzeRow}>
                          <Button
                            title={failed ? 'Retry' : 'Analyze'}
                            small
                            kind={failed ? 'ghost' : 'primary'}
                            loading={starting === v.id}
                            disabled={!!starting}
                            onPress={() => analyze(v.id)}
                          />
                          {!isPro && (v.duration_seconds ?? 0) > 2 * 3600 && v.status === 'pending' ? (
                            <Tag text="First 2h on free" color={colors.gold} />
                          ) : null}
                        </View>
                      )}
                    </View>
                  </View>
                </Pressable>
              );
            })
          )}
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  hello: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  sum: { marginTop: 8, fontFamily: fonts.mono, fontSize: 12, letterSpacing: 0.6, color: colors.ink3 },
  tabs: { flexDirection: 'row', gap: 22, marginTop: 22, borderBottomWidth: 1, borderBottomColor: colors.line },
  tab: { paddingBottom: 12, marginBottom: -1, borderBottomWidth: 1, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: colors.ink },
  tabText: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.3, textTransform: 'uppercase', color: colors.ink3 },
  none: { paddingVertical: 28, fontSize: 14, color: colors.ink3 },
  row: { flexDirection: 'row', gap: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.line },
  thumb: { width: 104, height: 58, alignSelf: 'flex-start', borderRadius: 8, overflow: 'hidden', backgroundColor: colors.surface2 },
  main: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '600', lineHeight: 20, color: colors.ink },
  meta: { marginTop: 4, fontFamily: fonts.mono, fontSize: 11.5, letterSpacing: 0.3, color: colors.ink3 },
  line: { marginTop: 8, fontSize: 14, lineHeight: 20, color: colors.ink2 },
  failed: { marginTop: 8, fontSize: 13.5, lineHeight: 19, color: colors.danger },
  end: { marginTop: 10 },
  res: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resWord: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' },
  resNum: { fontFamily: fonts.numbers, fontSize: 26, lineHeight: 28 },
  analyzeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  empty: { marginTop: 24, paddingVertical: 28, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
  emptyTitle: { fontFamily: fonts.display, fontSize: 22, lineHeight: 29, letterSpacing: -0.4, color: colors.ink },
  steps: { gap: 6, marginTop: 14, marginBottom: 22 },
  step: { fontSize: 15, lineHeight: 22, color: colors.ink2 },
});
