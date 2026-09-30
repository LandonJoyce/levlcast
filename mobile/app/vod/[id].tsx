import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { ChevronDown, ChevronUp, Play } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';
import { Button, Hairline, Label, LabelRow, Loading, Note, Screen, SectionHead, Tag } from '@/lib/ui';
import { RankPanel } from '@/components/RankPanel';
import { SealedResult } from '@/components/SealedResult';
import { Scorecard } from '@/components/Scorecard';
import { Breakdown, type TrendPoint } from '@/components/Breakdown';
import { PlayableText } from '@/components/Playable';
import { AnalysisProgressCard } from '@/components/AnalysisBar';
import { ClipCard, MomentRow, type ClipRow, type Peak } from '@/components/Moments';
import { isPlacementDelta } from '@/lib/rank';
import { callOutcome, hasPaidPlan, isLocked, isSealed, lockOpensAt } from '@/lib/sealed';
import { coachedSeconds, FREE_COACHED_SECONDS } from '@/lib/progress';
import { clean, clock, formatDuration, secondsFromStamp, signed, streamLength, watchAt } from '@/lib/time';
import { api, makeClip, makeReel, startReport } from '@/lib/api';

/*
 * One page per stream, in the order a game shows you after a match (the
 * site's /dashboard/vods/[id]): the result and the rank it left you on,
 * what to do next stream, where the points went, the clips and moments,
 * and the full breakdown folded away at the bottom.
 */

type FollowUpStatus = 'fixed' | 'partial' | 'regressed' | 'not_addressed';
const FOLLOW_UP_LABEL: Record<FollowUpStatus, string> = {
  fixed: 'Did it',
  partial: 'Partly',
  regressed: 'Slipped',
  not_addressed: 'Not yet',
};
const FOLLOW_UP_COLOR: Record<FollowUpStatus, string> = {
  fixed: colors.green,
  partial: colors.warn,
  regressed: colors.danger,
  not_addressed: colors.ink3,
};

function readFollowUp(raw: unknown) {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, any>;
  const status = r.status as FollowUpStatus;
  if (!(status in FOLLOW_UP_LABEL) || typeof r.prior_priority !== 'string' || !r.prior_priority.trim()) return null;
  const m = r.metric as Record<string, any> | undefined;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? String(Math.round(v * 10) / 10) : null);
  const before = num(m?.before);
  const after = num(m?.after);
  let metric: { label: string; before: string; after: string; unit: string } | null = null;
  if (m && typeof m.label === 'string' && m.label.trim() && before !== null && after !== null) {
    const pct = /_pct$/i.test(m.label);
    const words = m.label.trim().replace(/_pct$/i, '').replace(/_/g, ' ');
    const unit = typeof m.unit === 'string' && m.unit.trim() ? m.unit.trim() : pct ? '%' : '';
    metric = { label: words.charAt(0).toUpperCase() + words.slice(1), before, after, unit: unit === '%' ? '%' : unit ? ` ${unit}` : '' };
  }
  return {
    ask: clean(r.prior_priority.trim()),
    status,
    evidence: typeof r.evidence === 'string' && r.evidence.trim() ? clean(r.evidence.trim()) : null,
    metric,
  };
}

type FailureKind = 'playback_token' | 'timeout' | 'generic';
function categorizeFailure(reason: string | null | undefined): FailureKind {
  const r = (reason ?? '').toLowerCase();
  if (r.includes('playback token') || r.includes('blocked access') || r.includes('subscriber-only') || r.includes('dmca')) return 'playback_token';
  if (r.includes('timed out') || r.includes('timeout') || r.includes('stalled')) return 'timeout';
  return 'generic';
}

type Prior = { stream_date: string | null; analyzed_at: string | null; score: number | null; kind: string | null; breakdown: any };

export default function StreamScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [vod, setVod] = useState<any>(null);
  const [clips, setClips] = useState<ClipRow[]>([]);
  const [prior, setPrior] = useState<Prior[]>([]);
  const [isPro, setIsPro] = useState(false);
  const [firstReport, setFirstReport] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const goPro = useCallback(() => router.push('/subscribe'), [router]);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }
      const { data: v, error: vErr } = await supabase
        .from('vods')
        .select(
          'id, title, duration_seconds, status, stream_date, analyzed_at, updated_at, progress, coach_report, twitch_vod_id, failed_reason, peak_data, rank_delta, rank_points_after, result_opened_at, result_call, sealed_extra_week'
        )
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (vErr) throw vErr;
      if (!v) {
        setVod(null);
        return;
      }
      const streamDate = (v.stream_date as string | null) ?? new Date(0).toISOString();
      const [clipsRes, priorRes, profileRes, countRes] = await Promise.all([
        supabase
          .from('clips')
          .select('id, title, status, video_url, thumbnail_url, caption_text, start_time_seconds, end_time_seconds, is_highlight_reel, peak_category, vod_id, failed_reason')
          .eq('user_id', user.id)
          .eq('vod_id', id)
          .order('created_at', { ascending: false }),
        // Only streams from before this one, so every comparison is against a stream that came first.
        supabase
          .from('vods')
          .select('stream_date, analyzed_at, score:coach_report->overall_score, kind:coach_report->>streamer_type, breakdown:coach_report->score_breakdown')
          .eq('user_id', user.id)
          .eq('status', 'ready')
          .neq('id', id)
          .lt('stream_date', streamDate)
          .order('stream_date', { ascending: false, nullsFirst: false })
          .limit(12),
        supabase.from('profiles').select('plan, subscription_expires_at').eq('id', user.id).single(),
        supabase.from('vods').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'ready'),
      ]);
      setVod(v);
      setClips((clipsRes.data ?? []) as ClipRow[]);
      setPrior((priorRes.data ?? []) as unknown as Prior[]);
      setIsPro(hasPaidPlan(profileRes.data));
      setFirstReport((countRes.count ?? 0) === 0);
    } catch (err: any) {
      setError(err?.message || "Couldn't load this stream");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, router]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const running = vod?.status === 'transcribing' || vod?.status === 'analyzing';
  const clipBusy = clips.some((c) => c.status === 'processing');
  useEffect(() => {
    if (!running && !clipBusy) return;
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [running, clipBusy, load]);

  const ready = vod?.status === 'ready';
  const sealed = ready && isSealed(vod);

  async function share() {
    const r = await api(`/api/vods/${id}/share`, { method: 'POST' });
    if (!r.ok || !r.data?.url) {
      Alert.alert("Couldn't make a link", 'Try again in a minute.');
      return;
    }
    Share.share({ message: `My LevlCast report for ${vod?.title ?? 'my stream'}`, url: r.data.url }).catch(() => {});
  }

  const header = (
    <Stack.Screen
      options={{
        headerRight: ready && !sealed ? () => (
          <Pressable onPress={share} hitSlop={10} style={{ paddingHorizontal: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.ink }}>Share</Text>
          </Pressable>
        ) : undefined,
      }}
    />
  );

  if (loading) return <Loading />;
  if (error || !vod) {
    return (
      <Screen inset={false}>
        {header}
        <Text style={s.stateTitle}>{error ? "Couldn't load this stream." : 'Stream not found.'}</Text>
        {error ? <Text style={s.body}>{error}</Text> : null}
        <Button title="Try again" kind="ghost" onPress={load} style={{ marginTop: 16, alignSelf: 'flex-start' }} />
      </Screen>
    );
  }

  const report = vod.coach_report as Record<string, any> | null;
  const peaks = ((vod.peak_data as Peak[] | null) ?? []).filter((p) => Number.isFinite(Number(p.start)));
  const twitchId = (vod.twitch_vod_id as string | null) ?? null;
  const dateLabel = vod.stream_date
    ? new Date(vod.stream_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  async function analyze() {
    setBusy('analyze');
    const ok = await startReport(vod.id, goPro);
    setBusy(null);
    if (ok) load();
  }

  const head = (
    <View style={{ marginBottom: 20 }}>
      <Text style={s.title}>{vod.title || 'Untitled stream'}</Text>
      <Text style={s.meta}>
        {[dateLabel, vod.duration_seconds ? formatDuration(vod.duration_seconds) : null].filter(Boolean).join(' · ')}
      </Text>
    </View>
  );

  // ── Not ready yet ──
  if (!ready) {
    const kind = vod.status === 'failed' ? categorizeFailure(vod.failed_reason) : null;
    return (
      <Screen inset={false} refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
        {header}
        {head}
        {running ? (
          <AnalysisProgressCard
            input={{ status: vod.status, durationSeconds: coachedSeconds(vod.duration_seconds, isPro), updatedAt: vod.updated_at, progress: vod.progress ?? null }}
            firstPartOnly={!isPro && (vod.duration_seconds ?? 0) > FREE_COACHED_SECONDS}
            first={firstReport}
          />
        ) : vod.status === 'pending' ? (
          <View style={s.state}>
            <Text style={s.stateTitle}>Not analyzed yet</Text>
            <Text style={s.body}>
              {isPro
                ? 'Pro coaches the whole stream.'
                : (vod.duration_seconds ?? 0) > FREE_COACHED_SECONDS
                  ? `A free report coaches the first 2 hours of this ${streamLength(vod.duration_seconds)} stream. Pro coaches all of it.`
                  : 'Your report is usually ready in about ten minutes.'}
            </Text>
            <Button title="Analyze this stream" onPress={analyze} loading={busy === 'analyze'} style={{ marginTop: 18, alignSelf: 'flex-start' }} />
          </View>
        ) : kind === 'playback_token' ? (
          <View style={s.state}>
            <Label color={colors.warn}>Twitch blocked access</Label>
            <Text style={[s.stateTitle, { marginTop: 8 }]}>We couldn&apos;t get this VOD&apos;s audio from Twitch.</Text>
            <Text style={s.body}>
              Twitch says it&apos;s restricted, so nothing counted against your reports. Usually it&apos;s a subscriber-only VOD, one muted for
              copyrighted music, or one that expired (Affiliates keep VODs 14 days, Partners 60).
            </Text>
            <View style={s.stateActions}>
              <Button title="Retry" onPress={analyze} loading={busy === 'analyze'} />
              {twitchId ? <Button title="Open on Twitch" kind="ghost" onPress={() => Linking.openURL(`https://www.twitch.tv/videos/${twitchId}`)} /> : null}
            </View>
          </View>
        ) : kind === 'timeout' ? (
          <View style={s.state}>
            <Label color={colors.warn}>Timed out</Label>
            <Text style={[s.stateTitle, { marginTop: 8 }]}>The analysis didn&apos;t finish in time.</Text>
            <Text style={s.body}>Usually Twitch was slow to send the audio. Nothing counted against your reports, and a retry almost always works.</Text>
            <View style={s.stateActions}>
              <Button title="Retry" onPress={analyze} loading={busy === 'analyze'} />
            </View>
          </View>
        ) : (
          <View style={s.state}>
            <Label color={colors.danger}>Analysis failed</Label>
            <Text style={[s.stateTitle, { marginTop: 8 }]}>{vod.failed_reason || 'Something went wrong on our side.'}</Text>
            <View style={s.stateActions}>
              <Button title="Retry" onPress={analyze} loading={busy === 'analyze'} />
            </View>
          </View>
        )}
      </Screen>
    );
  }

  // ── Sealed: the call and the reveal ──
  if (sealed) {
    const locked = isLocked(vod, isPro);
    return (
      <Screen inset={false}>
        {header}
        {head}
        <Hairline />
        <View style={{ paddingVertical: 24 }}>
          <SealedResult
            vodId={vod.id}
            placement={vod.rank_delta != null && isPlacementDelta(vod.rank_delta)}
            locked={locked && vod.sealed_extra_week ? { opensAt: lockOpensAt(vod.sealed_extra_week) } : null}
            onOpened={() => load()}
            onGoPro={goPro}
          />
        </View>
        <Hairline />
      </Screen>
    );
  }

  // ── The report ──
  const currentScore = typeof report?.overall_score === 'number' ? (report.overall_score as number) : undefined;
  const streamerType = report?.streamer_type ?? null;
  const previous = (streamerType ? prior.find((p) => p.kind === streamerType) : null) ?? prior[0] ?? null;
  const previousScore = typeof previous?.score === 'number' ? previous.score : undefined;
  const scoreDelta = currentScore !== undefined && previousScore !== undefined ? currentScore - previousScore : null;
  const rankDelta = (vod.rank_delta as number | null) ?? null;
  const placement = rankDelta !== null && isPlacementDelta(rankDelta);
  const result = rankDelta !== null && !placement ? rankDelta : null;
  const called = callOutcome(vod) === 'called';

  const headline: string | null = report?.punch_line ? clean(report.punch_line) : report?.recommendation ? clean(report.recommendation) : null;
  const mission: string | null = report?.next_stream_goals?.[0] ? clean(report.next_stream_goals[0]) : report?.recommendation ? clean(report.recommendation) : null;
  const best = report?.best_moment as { time?: string; description?: string } | undefined;
  const missed = report?.missed_clip as { time?: string; note?: string } | undefined;
  const followUp = readFollowUp(report?.progress_on_prior_fix);

  // Oldest first, this stream last.
  const trajectory: TrendPoint[] | undefined =
    currentScore !== undefined
      ? [
          ...prior
            .filter((p) => typeof p.score === 'number')
            .slice(0, 9)
            .reverse()
            .map((p) => ({ score: p.score as number })),
          { score: currentScore, current: true },
        ]
      : undefined;

  const madeClips = clips.filter((c) => c.status === 'ready' || c.status === 'processing');
  const failedClips = clips.filter((c) => c.status === 'failed');
  const reel = clips.find((c) => c.is_highlight_reel && (c.status === 'ready' || c.status === 'processing'));
  const readyCount = clips.filter((c) => c.status === 'ready' && !c.is_highlight_reel).length;

  function clipFor(p: Peak): ClipRow | undefined {
    const st = Math.round(Number(p.start));
    const en = Math.round(Number(p.end));
    return clips.find(
      (c) =>
        !c.is_highlight_reel &&
        (c.status === 'ready' || c.status === 'processing') &&
        (c.start_time_seconds ?? -1) >= st - 60 &&
        (c.start_time_seconds ?? -1) <= en + 5
    );
  }

  async function make(i: number) {
    setBusy(`peak-${i}`);
    const ok = await makeClip(vod.id, i, goPro);
    setBusy(null);
    if (ok) load();
  }

  async function reelIt() {
    setBusy('reel');
    const ok = await makeReel(vod.id, goPro);
    setBusy(null);
    if (ok) load();
  }

  return (
    <Screen inset={false} refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      {header}
      {head}

      {!isPro && report?.coached_range && !report.coached_range.picked ? (
        <View style={{ marginBottom: 18 }}>
          <Note>
            <Text style={s.noteText}>
              This report coaches the first {streamLength(report.coached_range.end)} of your {streamLength(report.coached_range.total)} stream.{' '}
              <Text style={s.link} onPress={goPro}>
                Pro coaches the whole stream.
              </Text>
            </Text>
          </Note>
        </View>
      ) : null}

      <Hairline />
      <View style={{ paddingTop: 24 }}>
        <LabelRow
          left={
            <>
              <Label>Result</Label>
              {called ? <Tag text="Called it" color={colors.gold} /> : null}
            </>
          }
          right={
            currentScore !== undefined ? (
              <Text style={s.scoreK}>
                Score {currentScore}
                {isPro && scoreDelta !== null && scoreDelta !== 0 ? (
                  <Text style={{ color: scoreDelta > 0 ? colors.green : colors.danger }}> {signed(scoreDelta)}</Text>
                ) : null}
              </Text>
            ) : undefined
          }
        />
        {result !== null ? (
          <View style={s.verdict}>
            <Text style={[s.verdictWord, { color: result >= 0 ? colors.green : colors.danger }]}>{result >= 0 ? 'Win' : 'Loss'}</Text>
            <Text style={[s.verdictNum, { color: result >= 0 ? colors.green : colors.danger }]}>{signed(result)}</Text>
          </View>
        ) : placement ? (
          <Text style={[s.verdictWord, { color: colors.ink }]}>Placed</Text>
        ) : null}
        {headline ? <Text style={s.headline}>{headline}</Text> : null}
      </View>
      <RankPanel points={(vod.rank_points_after as number | null) ?? null} delta={rankDelta} label="Rank after this stream" />
      <Hairline />

      {report && (followUp || mission || best?.description) ? (
        <View style={s.block}>
          {followUp ? (
            <View style={s.follow}>
              <LabelRow
                left={
                  <>
                    <Label>Last stream&apos;s fix</Label>
                    <Tag text={FOLLOW_UP_LABEL[followUp.status]} color={FOLLOW_UP_COLOR[followUp.status]} />
                  </>
                }
              />
              <Text style={s.followAsk}>{followUp.ask}</Text>
              {followUp.evidence ? <PlayableText text={followUp.evidence} vodId={twitchId} style={s.followWhy} /> : null}
              {followUp.metric ? (
                <Text style={s.metric}>
                  {followUp.metric.label}{' '}
                  <Text style={{ color: colors.ink }}>
                    {followUp.metric.before}
                    {followUp.metric.unit}
                  </Text>{' '}
                  to{' '}
                  <Text style={{ color: colors.ink }}>
                    {followUp.metric.after}
                    {followUp.metric.unit}
                  </Text>
                </Text>
              ) : null}
            </View>
          ) : null}
          {mission ? (
            <>
              <Label style={{ marginBottom: 10 }}>Do this next stream</Label>
              <Text style={s.fix}>{mission}</Text>
              <Text style={s.small}>Your next report checks whether you did it.</Text>
            </>
          ) : null}
          {best?.description ? (
            <View style={[s.best, !mission && !followUp && { marginTop: 0, paddingTop: 0, borderTopWidth: 0 }]}>
              <Label style={{ marginBottom: 6 }}>Best moment{best.time ? ` · ${clock(secondsFromStamp(best.time))}` : ''}</Label>
              <Text style={s.bestText}>{clean(best.description)}</Text>
              {twitchId && best.time ? (
                <Pressable onPress={() => watchAt(twitchId, secondsFromStamp(best.time))} hitSlop={8} style={s.watch}>
                  <Play size={11} color={colors.ink} fill={colors.ink} />
                  <Text style={s.watchText}>Watch it</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      {report?.score_breakdown ? (
        <>
          <Hairline />
          <View style={s.block}>
            <Scorecard scores={report.score_breakdown} previousScores={previous?.breakdown ?? null} deadAirPct={report.dead_air_pct ?? null} />
          </View>
        </>
      ) : null}

      {(peaks.length > 0 || clips.length > 0) && (
        <View style={s.section}>
          <SectionHead title="Clips" meta={`${peaks.length} ${peaks.length === 1 ? 'moment' : 'moments'} · ${readyCount} made`} />
          {clipBusy ? <Text style={[s.small, { marginTop: 0, marginBottom: 12 }]}>Making a clip now. It takes a minute or two and this page updates on its own.</Text> : null}

          {madeClips.length > 0 && (
            <View style={s.grid}>
              {[...madeClips].sort((a, b) => Number(!!b.is_highlight_reel) - Number(!!a.is_highlight_reel)).map((c) => (
                <ClipCard key={c.id} clip={c} onPress={() => router.push(`/clip/${c.id}`)} />
              ))}
            </View>
          )}

          {failedClips.map((c) => (
            <View key={c.id} style={s.failedClip}>
              <Text style={s.failedTitle} numberOfLines={1}>{c.title || 'Untitled clip'}</Text>
              <Text style={s.failedWhy}>{c.failed_reason || "This clip didn't render. Open Clips to try it again."}</Text>
            </View>
          ))}

          {peaks.length > 1 && !reel ? (
            <Button
              title="Make a highlight reel"
              kind="ghost"
              small
              onPress={reelIt}
              loading={busy === 'reel'}
              disabled={clipBusy}
              style={{ alignSelf: 'flex-start', marginBottom: 6 }}
            />
          ) : null}

          {peaks.length > 0 && (
            <View style={s.moments}>
              {peaks.map((p, i) => {
                const c = clipFor(p);
                return (
                  <MomentRow
                    key={`peak-${i}`}
                    peak={p}
                    twitchVodId={twitchId}
                    clipState={c ? (c.status as 'ready' | 'processing') : null}
                    onOpenClip={c ? () => router.push(`/clip/${c.id}`) : undefined}
                    onMake={() => make(i)}
                    busy={busy === `peak-${i}`}
                    disabled={clipBusy || (busy !== null && busy !== `peak-${i}`)}
                  />
                );
              })}
              {missed?.time && missed?.note ? (
                <MomentRow missed peak={{ title: 'Almost a clip', start: secondsFromStamp(missed.time), end: 0, reason: clean(missed.note) }} twitchVodId={twitchId} />
              ) : null}
            </View>
          )}
        </View>
      )}

      {report ? (
        <View style={s.section}>
          <Pressable onPress={() => setShowAll((v) => !v)} style={s.fold}>
            <Text style={s.foldText}>Full breakdown</Text>
            {showAll ? <ChevronUp size={18} color={colors.ink3} /> : <ChevronDown size={18} color={colors.ink3} />}
          </Pressable>
          {showAll ? (
            <View style={{ paddingTop: 20 }}>
              <Breakdown report={report} twitchVodId={twitchId} durationSeconds={vod.duration_seconds} trajectory={trajectory} />
            </View>
          ) : null}
        </View>
      ) : (
        <View style={s.state}>
          <Text style={s.body}>There&apos;s no coach report for this stream. Analyze it again to get one.</Text>
        </View>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, letterSpacing: -0.6, color: colors.ink },
  meta: { marginTop: 8, fontFamily: fonts.mono, fontSize: 12, letterSpacing: 0.4, color: colors.ink3 },
  body: { marginTop: 8, fontSize: 15, lineHeight: 22, color: colors.ink2 },
  small: { marginTop: 12, fontSize: 13, lineHeight: 19, color: colors.ink3 },
  link: { color: colors.ink, fontWeight: '600', textDecorationLine: 'underline' },
  noteText: { fontSize: 14, lineHeight: 21, color: colors.ink3 },
  state: { paddingVertical: 26, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
  stateTitle: { fontFamily: fonts.display, fontSize: 20, lineHeight: 27, letterSpacing: -0.3, color: colors.ink },
  stateActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 },
  scoreK: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.1, textTransform: 'uppercase', color: colors.ink4 },
  verdict: { flexDirection: 'row', alignItems: 'baseline', gap: 14, marginTop: 2 },
  verdictWord: { fontFamily: fonts.numbers, fontSize: 76, lineHeight: 72, textTransform: 'uppercase' },
  verdictNum: { fontFamily: fonts.numbers, fontSize: 76, lineHeight: 72 },
  headline: { marginTop: 18, fontFamily: fonts.display, fontSize: 20, lineHeight: 28, letterSpacing: -0.3, color: colors.ink },
  block: { paddingVertical: 24 },
  follow: { marginBottom: 24, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: colors.line },
  followAsk: { fontSize: 15, fontWeight: '600', lineHeight: 22, color: colors.ink2 },
  followWhy: { marginTop: 8, fontSize: 14, lineHeight: 21, color: colors.ink3 },
  metric: { marginTop: 10, fontFamily: fonts.mono, fontSize: 12, color: colors.ink3 },
  fix: { fontFamily: fonts.display, fontSize: 20, lineHeight: 28, letterSpacing: -0.3, color: colors.ink },
  best: { marginTop: 26, paddingTop: 22, borderTopWidth: 1, borderTopColor: colors.line },
  bestText: { fontSize: 15, lineHeight: 23, color: colors.ink2 },
  watch: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, alignSelf: 'flex-start' },
  watchText: { fontFamily: fonts.mono, fontSize: 12, color: colors.ink, textDecorationLine: 'underline' },
  section: { marginTop: 28 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, rowGap: 20, marginBottom: 18 },
  failedClip: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.line },
  failedTitle: { fontSize: 14, fontWeight: '600', color: colors.ink },
  failedWhy: { marginTop: 2, fontSize: 13, color: colors.danger },
  moments: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 8 },
  fold: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
  foldText: { fontFamily: fonts.display, fontSize: 18, letterSpacing: -0.3, color: colors.ink },
});
