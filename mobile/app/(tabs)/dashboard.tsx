import { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { ChevronRight } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';
import { Bar, Button, Hairline, Label, LabelRow, Loading, PageTitle, Screen, SectionHead } from '@/lib/ui';
import { RankPanel } from '@/components/RankPanel';
import { SealedResult } from '@/components/SealedResult';
import { MatchRow } from '@/components/MatchRow';
import { categoryLabel } from '@/components/Moments';
import { buildMatchHistory, summarizeMatches, type MatchVodRow } from '@/lib/matches';
import { hasPaidPlan, isLocked, isPlacementResult, isSealed, lockOpensAt, pointsBeforeSealed } from '@/lib/sealed';
import { estimateAnalysis, coachedSeconds } from '@/lib/progress';
import { formatDate, formatDuration, signed } from '@/lib/time';
import { postToYouTube, startReport, syncStreams } from '@/lib/api';

/*
 * Home, in the site's order: where you stand (the rank), your last stream
 * and the one thing to fix, your last few matches, and clips waiting to go
 * out. A result that's in but not opened takes the last-stream spot, and
 * nothing else on the page gives it away.
 */

type ReadyVod = MatchVodRow & { sealed_extra_week?: string | null };
type LatestVod = {
  id: string;
  title: string | null;
  stream_date: string | null;
  analyzed_at: string | null;
  created_at: string | null;
  duration_seconds: number | null;
  rank_delta: number | null;
  coach_report: Record<string, any> | null;
  peak_data: unknown[] | null;
};
type RunningVod = {
  id: string;
  title: string | null;
  status: string;
  duration_seconds: number | null;
  updated_at: string | null;
  progress: any;
};

/** Brand-new accounts get their first report started for them, once per app run. */
let firstReportTried = false;

export default function HomeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [ready, setReady] = useState<ReadyVod[]>([]);
  const [latest, setLatest] = useState<LatestVod | null>(null);
  const [running, setRunning] = useState<RunningVod[]>([]);
  const [streamCount, setStreamCount] = useState(0);
  const [clips, setClips] = useState<any[]>([]);
  const [youTube, setYouTube] = useState(false);
  const [posting, setPosting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [now, setNow] = useState(Date.now());

  const goPro = useCallback(() => router.push('/subscribe'), [router]);

  const load = useCallback(async () => {
    try {
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }
      const [profileRes, readyRes, latestRes, runningRes, countRes, clipsRes, connRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('twitch_display_name, twitch_login, rank_points, plan, subscription_expires_at, created_at')
          .eq('id', user.id)
          .single(),
        supabase
          .from('vods')
          .select('id, title, analyzed_at, stream_date, created_at, duration_seconds, rank_delta, rank_points_after, result_opened_at, result_call, sealed_extra_week')
          .eq('user_id', user.id)
          .eq('status', 'ready'),
        supabase
          .from('vods')
          .select('id, title, stream_date, analyzed_at, created_at, duration_seconds, rank_delta, coach_report, peak_data')
          .eq('user_id', user.id)
          .eq('status', 'ready')
          .order('stream_date', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('vods')
          .select('id, title, status, duration_seconds, updated_at, progress')
          .eq('user_id', user.id)
          .in('status', ['transcribing', 'analyzing']),
        supabase.from('vods').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase
          .from('clips')
          .select('id, title, peak_category, vod_id')
          .eq('user_id', user.id)
          .eq('status', 'ready')
          .order('created_at', { ascending: false })
          .limit(10),
        supabase.from('social_connections').select('platform').eq('user_id', user.id),
      ]);
      if (profileRes.error && !profileRes.data) throw profileRes.error;

      const readyClips = clipsRes.data ?? [];
      let posted = new Set<string>();
      if (readyClips.length > 0) {
        const { data: posts } = await supabase
          .from('social_posts')
          .select('clip_id')
          .eq('user_id', user.id)
          .eq('platform', 'youtube')
          .in('clip_id', readyClips.map((c) => c.id));
        posted = new Set((posts ?? []).map((p: any) => p.clip_id));
      }

      setProfile(profileRes.data);
      setReady((readyRes.data ?? []) as ReadyVod[]);
      setLatest((latestRes.data as LatestVod | null) ?? null);
      setRunning((runningRes.data ?? []) as RunningVod[]);
      setStreamCount(countRes.count ?? 0);
      setClips(readyClips.filter((c) => !posted.has(c.id)).slice(0, 5));
      setYouTube((connRes.data ?? []).some((c: any) => c.platform === 'youtube'));
      setNow(Date.now());

      // Same rule as a new sign-up on the site: pull in their streams and
      // start the first report, so a new account doesn't land on nothing.
      const created = Date.parse(String(profileRes.data?.created_at ?? ''));
      const isNew = Number.isFinite(created) && Date.now() - created < 30 * 60 * 1000;
      // Apple-only accounts have no Twitch to pull from.
      if (isNew && profileRes.data?.twitch_login && !firstReportTried && (readyRes.data ?? []).length === 0 && (runningRes.data ?? []).length === 0) {
        firstReportTried = true;
        startFirstReport(user.id);
      }
    } catch (err: any) {
      setError(err?.message || "Couldn't load your home page");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function startFirstReport(userId: string) {
    setSyncing(true);
    try {
      await syncStreams();
      const { data } = await supabase
        .from('vods')
        .select('id, duration_seconds, status')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('stream_date', { ascending: false })
        .limit(10);
      const first = (data ?? []).find((v: any) => (v.duration_seconds ?? 0) >= 300);
      if (first) await startReport(first.id, goPro);
    } finally {
      setSyncing(false);
      load();
    }
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Keep the running report's bar honest and pick the result up when it lands.
  useFocusEffect(
    useCallback(() => {
      if (running.length === 0) return;
      const tick = setInterval(() => setNow(Date.now()), 1000);
      const poll = setInterval(load, 10000);
      return () => {
        clearInterval(tick);
        clearInterval(poll);
      };
    }, [running.length, load])
  );

  async function pullStreams() {
    setSyncing(true);
    const r = await syncStreams();
    setSyncing(false);
    if (r?.synced === 0 && r?.total === 0 && r?.message) {
      Alert.alert('No past broadcasts yet', r.message);
    }
    load();
  }

  async function post(clipId: string) {
    setPosting(clipId);
    const url = await postToYouTube(clipId, goPro);
    setPosting(null);
    if (url) load();
  }

  if (loading) return <Loading />;

  const name = profile?.twitch_display_name || 'Streamer';
  const isPro = hasPaidPlan(profile);

  if (error) {
    return (
      <Screen onRefresh={load}>
        <PageTitle>Couldn&apos;t load this</PageTitle>
        <Text style={s.body}>{error}</Text>
        <Button title="Try again" onPress={load} style={{ marginTop: 18, alignSelf: 'flex-start' }} />
      </Screen>
    );
  }

  const header = (
    <View style={s.hello}>
      <PageTitle style={{ flex: 1 }}>Hey, {name}.</PageTitle>
      {!isPro && <Button title="Go Pro" kind="ghost" small onPress={goPro} />}
    </View>
  );

  const runningCard =
    running.length > 0 ? (
      <Pressable onPress={() => router.push(`/vod/${running[0].id}`)} style={s.running}>
        {(() => {
          const v = running[0];
          const e = estimateAnalysis(
            { status: v.status, durationSeconds: coachedSeconds(v.duration_seconds, isPro), updatedAt: v.updated_at, progress: v.progress ?? null },
            now
          );
          return (
            <>
              <LabelRow left={ready.length === 0 ? 'Your first report' : 'Making a report'} right={`${Math.round(e.fraction * 100)}%`} />
              <Text style={s.runningTitle} numberOfLines={1}>{v.title || 'Your stream'}</Text>
              <Bar fraction={e.fraction} height={6} style={{ marginTop: 12 }} />
              <Text style={s.small}>
                {e.slow ? 'Taking longer than usual.' : `About ${Math.max(1, Math.ceil(e.totalMinutes * (1 - e.fraction)))} min left.`} It keeps going if you
                close the app.
              </Text>
            </>
          );
        })()}
      </Pressable>
    ) : null;

  // ── Nothing analyzed yet ──
  if (ready.length === 0) {
    return (
      <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
        {header}
        {runningCard ?? (
          <View style={s.empty}>
            {streamCount === 0 ? (
              <>
                <Text style={s.emptyTitle}>{syncing ? 'Pulling in your streams...' : 'Pull in your streams to get started.'}</Text>
                <View style={s.steps}>
                  <Text style={s.step}>1. Sync your last 20 Twitch streams.</Text>
                  <Text style={s.step}>2. Press Analyze on one.</Text>
                  <Text style={s.step}>3. Get your report, your rank and your clips.</Text>
                </View>
                <Button title="Sync my streams" onPress={pullStreams} loading={syncing} style={{ alignSelf: 'flex-start' }} />
                <Text style={[s.small, { marginTop: 16 }]}>
                  If nothing shows up, turn on Store past broadcasts in your Twitch settings, then stream once.
                </Text>
              </>
            ) : (
              <>
                <Text style={s.emptyTitle}>Your streams are in. Pick one to analyze.</Text>
                <Text style={[s.body, { marginTop: 8 }]}>
                  Your first report places you on the ladder. {isPro ? 'Pro coaches the whole stream.' : 'Free coaches the first 2 hours of any stream.'}
                </Text>
                <Button title="Pick a stream" onPress={() => router.push('/(tabs)/vods')} style={{ marginTop: 18, alignSelf: 'flex-start' }} />
              </>
            )}
          </View>
        )}
      </Screen>
    );
  }

  // ── The ladder, the last stream, the matches ──
  const byAnalyzed = [...ready].sort((a, b) => String(b.analyzed_at ?? '').localeCompare(String(a.analyzed_at ?? '')));
  const sealedVods = byAnalyzed.filter((v) => isSealed({ ...v, status: 'ready' }));
  const sealedTop = sealedVods[0] ?? null;
  const opened = byAnalyzed.filter((v) => !isSealed({ ...v, status: 'ready' }));
  const rankPoints = (profile?.rank_points as number | null) ?? null;
  const shownPoints = sealedVods.length ? pointsBeforeSealed(rankPoints, sealedVods) : rankPoints;
  const shownDelta = sealedVods.length ? null : ((opened[0]?.rank_delta as number | null) ?? null);
  const wins = opened
    .slice(0, 12)
    .map((v) => v.rank_delta)
    .filter((d): d is number => d !== null && d > 0 && d < 200);
  const avgWin = wins.length ? Math.round(wins.reduce((a, b) => a + b, 0) / wins.length) : null;

  const matches = buildMatchHistory(ready);
  const summary = summarizeMatches(matches);

  const latestDelta = latest?.rank_delta ?? null;
  const latestResult = latestDelta !== null && Math.abs(latestDelta) < 200 ? latestDelta : null;
  const report = latest?.coach_report ?? null;
  const fix: string | null = report?.next_stream_goals?.[0] ?? report?.recommendation ?? null;
  const moments = Array.isArray(latest?.peak_data) ? latest!.peak_data!.length : 0;

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      {header}

      <Hairline style={{ marginTop: 18 }} />
      <RankPanel key={String(shownPoints)} points={shownPoints} delta={shownDelta} avgWin={avgWin} />
      <Hairline />

      <View style={s.block}>
        {sealedTop ? (
          <SealedResult
            key={sealedTop.id}
            vodId={sealedTop.id}
            title={sealedTop.title}
            placement={isPlacementResult(sealedTop)}
            locked={isLocked({ ...sealedTop, status: 'ready' }, isPro) && sealedTop.sealed_extra_week ? { opensAt: lockOpensAt(sealedTop.sealed_extra_week) } : null}
            onOpened={(r) => (r.placement ? router.push(`/vod/${sealedTop.id}`) : load())}
            onGoPro={goPro}
          />
        ) : latest ? (
          <>
            <LabelRow
              left="Last stream"
              right={[formatDate(latest.stream_date ?? latest.analyzed_at ?? latest.created_at), formatDuration(latest.duration_seconds)].filter(Boolean).join(' · ')}
            />
            <Text style={s.lastTitle}>{latest.title || 'Your most recent broadcast'}</Text>
            {latestResult !== null && (
              <View style={s.result}>
                <Text style={[s.resultWord, { color: latestResult >= 0 ? colors.green : colors.danger }]}>{latestResult >= 0 ? 'Win' : 'Loss'}</Text>
                <Text style={[s.resultNum, { color: latestResult >= 0 ? colors.green : colors.danger }]}>{signed(latestResult)}</Text>
              </View>
            )}
            <Label style={{ marginTop: 22, marginBottom: 10 }}>Your fix for next stream</Label>
            <Text style={s.fix}>{fix || 'Open the report to see what to work on next.'}</Text>
            <View style={s.actions}>
              <Button title={'Open the report →'} onPress={() => router.push(`/vod/${latest.id}`)} />
              {moments > 0 && (
                <Button title={`${moments} ${moments === 1 ? 'moment' : 'moments'} to clip`} kind="ghost" onPress={() => router.push('/(tabs)/clips')} />
              )}
            </View>
          </>
        ) : null}
      </View>

      {runningCard ? <View style={{ marginBottom: 28 }}>{runningCard}</View> : null}

      <View style={s.section}>
        <SectionHead
          title="Recent matches"
          meta={summary.games > 0 ? `${summary.wins}W ${summary.losses}L · last ${summary.games}` : undefined}
          action="All"
          onAction={() => router.push('/(tabs)/matches')}
        />
        <View style={s.matchList}>
          {matches.slice(0, 4).map((m) => (
            <MatchRow key={m.id} match={m} onPress={() => router.push(`/vod/${m.id}`)} />
          ))}
        </View>
      </View>

      {clips.length > 0 && (
        <View style={s.section}>
          <SectionHead title="Clips to post" meta={`${clips.length} waiting`} action="All" onAction={() => router.push('/(tabs)/clips')} />
          {!youTube && (
            <Text style={[s.small, { marginTop: 0, marginBottom: 10 }]}>
              Share them from the clip page, or connect YouTube on{' '}
              <Text style={s.link} onPress={() => Linking.openURL('https://levlcast.com/dashboard/settings#connections')}>
                levlcast.com
              </Text>{' '}
              to post Shorts in one tap.
            </Text>
          )}
          <View style={s.clipList}>
            {clips.map((c) => (
              <Pressable key={c.id} onPress={() => router.push(`/clip/${c.id}`)} style={({ pressed }) => [s.clipRow, pressed && { backgroundColor: colors.wash }]}>
                <Text style={s.clipCat} numberOfLines={1}>{categoryLabel(c.peak_category) || 'Clip'}</Text>
                <Text style={s.clipTitle} numberOfLines={1}>{c.title || 'Untitled clip'}</Text>
                {youTube ? (
                  <Button title="Post" kind="ghost" small loading={posting === c.id} onPress={() => post(c.id)} />
                ) : (
                  <ChevronRight size={16} color={colors.ink4} />
                )}
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  hello: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  body: { fontSize: 15, lineHeight: 22, color: colors.ink2 },
  small: { marginTop: 10, fontSize: 13, lineHeight: 19, color: colors.ink3 },
  link: { color: colors.ink, fontWeight: '600', textDecorationLine: 'underline' },
  block: { paddingVertical: 24, marginBottom: 12 },
  lastTitle: { fontFamily: fonts.display, fontSize: 19, lineHeight: 25, letterSpacing: -0.3, color: colors.ink },
  result: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 10 },
  resultWord: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' },
  resultNum: { fontFamily: fonts.numbers, fontSize: 44, lineHeight: 44 },
  fix: { fontFamily: fonts.display, fontSize: 19, lineHeight: 27, letterSpacing: -0.3, color: colors.ink },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 22 },
  running: { paddingVertical: 18, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  runningTitle: { fontSize: 15, fontWeight: '600', color: colors.ink },
  section: { marginBottom: 32 },
  matchList: { borderTopWidth: 1, borderTopColor: colors.line },
  clipList: { borderTopWidth: 1, borderTopColor: colors.line },
  clipRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  clipCat: { width: 74, fontFamily: fonts.mono, fontSize: 10.5, letterSpacing: 1, textTransform: 'uppercase', color: colors.ink4 },
  clipTitle: { flex: 1, fontSize: 14.5, fontWeight: '600', color: colors.ink },
  empty: { marginTop: 24, paddingVertical: 28, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
  emptyTitle: { fontFamily: fonts.display, fontSize: 22, lineHeight: 29, letterSpacing: -0.4, color: colors.ink },
  steps: { gap: 6, marginTop: 14, marginBottom: 22 },
  step: { fontSize: 15, lineHeight: 22, color: colors.ink2 },
});
