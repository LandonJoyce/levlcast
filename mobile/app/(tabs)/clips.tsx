import { useCallback, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';
import { Button, Loading, PageTitle, Screen, SectionHead } from '@/lib/ui';
import { ClipCard, MomentRow, type ClipRow, type Peak } from '@/components/Moments';
import { formatDate } from '@/lib/time';
import { confirmDeleteClip, makeClip, retryClip } from '@/lib/api';

/*
 * Clips you've made, and the moments you haven't clipped yet (the site's
 * Clips page). Made clips are 9:16 cards; moments are listed under the
 * stream they came from, the newest few streams open and the rest folded.
 */

const OPEN_STREAMS = 3;

type Group = { id: string; title: string; date: string | null; twitchVodId: string | null; moments: Array<Peak & { index: number }> };

export default function ClipsScreen() {
  const router = useRouter();
  const [clips, setClips] = useState<ClipRow[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [vodTitle, setVodTitle] = useState<Map<string, string>>(new Map());
  const [posted, setPosted] = useState<Map<string, string | null>>(new Map());
  const [youTube, setYouTube] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [showOlder, setShowOlder] = useState(false);
  const [showPosted, setShowPosted] = useState(false);
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
      const [clipsRes, vodsRes, connRes] = await Promise.all([
        supabase
          .from('clips')
          .select('id, title, status, video_url, thumbnail_url, caption_text, start_time_seconds, end_time_seconds, is_highlight_reel, peak_category, vod_id, failed_reason')
          .eq('user_id', user.id)
          .in('status', ['ready', 'processing', 'failed'])
          .order('created_at', { ascending: false }),
        supabase
          .from('vods')
          .select('id, title, peak_data, stream_date, twitch_vod_id')
          .eq('user_id', user.id)
          .eq('status', 'ready')
          .not('peak_data', 'is', null)
          .order('stream_date', { ascending: false }),
        supabase.from('social_connections').select('platform').eq('user_id', user.id),
      ]);
      if (clipsRes.error) throw clipsRes.error;
      const all = (clipsRes.data ?? []) as ClipRow[];
      const readyIds = all.filter((c) => c.status === 'ready').map((c) => c.id);
      const postMap = new Map<string, string | null>();
      if (readyIds.length > 0) {
        const { data: posts } = await supabase
          .from('social_posts')
          .select('clip_id, platform_url')
          .eq('user_id', user.id)
          .eq('platform', 'youtube')
          .in('clip_id', readyIds);
        for (const p of posts ?? []) postMap.set((p as any).clip_id, (p as any).platform_url ?? null);
      }

      // Moments without a clip, per stream. A clip trimmed in the editor can
      // start a good way after its moment, so anything from a minute before
      // the moment to its end counts as that moment's clip.
      const vods = vodsRes.data ?? [];
      const g: Group[] = vods
        .map((v: any) => {
          const peaks = ((v.peak_data as Peak[] | null) ?? []).map((p, index) => ({ ...p, index }));
          const open = peaks.filter(
            (p) =>
              !all.some(
                (c) =>
                  c.vod_id === v.id &&
                  !c.is_highlight_reel &&
                  (c.status === 'ready' || c.status === 'processing') &&
                  (c.start_time_seconds ?? -1) >= Math.round(p.start) - 60 &&
                  (c.start_time_seconds ?? -1) <= Math.round(p.end) + 5
              )
          );
          return { id: v.id, title: v.title, date: v.stream_date, twitchVodId: v.twitch_vod_id, moments: open };
        })
        .filter((x) => x.moments.length > 0);

      setClips(all);
      setGroups(g);
      setVodTitle(new Map(vods.map((v: any) => [v.id, v.title])));
      setPosted(postMap);
      setYouTube((connRes.data ?? []).some((c: any) => c.platform === 'youtube'));
    } catch (err: any) {
      setError(err?.message || "Couldn't load your clips");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const making = clips.filter((c) => c.status === 'processing');
  useFocusEffect(
    useCallback(() => {
      if (making.length === 0) return;
      const t = setInterval(load, 10000);
      return () => clearInterval(t);
    }, [making.length, load])
  );

  async function make(vodId: string, index: number) {
    setBusy(`${vodId}-${index}`);
    const ok = await makeClip(vodId, index, goPro);
    setBusy(null);
    if (ok) load();
  }

  async function retry(c: ClipRow) {
    setBusy(c.id);
    const ok = await retryClip(c.id, c.vod_id, c.start_time_seconds ?? 0, goPro);
    setBusy(null);
    if (ok) load();
  }

  async function remove(c: ClipRow) {
    const gone = await confirmDeleteClip(c.id);
    if (gone) load();
  }

  if (loading) return <Loading />;

  const ready = clips.filter((c) => c.status === 'ready');
  const failed = clips.filter((c) => c.status === 'failed');
  const toPost = ready.filter((c) => !posted.has(c.id));
  const done = ready.filter((c) => posted.has(c.id));
  const momentCount = groups.reduce((n, g) => n + g.moments.length, 0);
  const nothing = ready.length === 0 && making.length === 0 && failed.length === 0 && momentCount === 0;
  const clipBusy = making.length > 0;

  const renderGroup = (g: Group) => (
    <View key={g.id} style={s.group}>
      <Pressable onPress={() => router.push(`/vod/${g.id}`)} style={s.groupHead} hitSlop={6}>
        <Text style={s.groupTitle} numberOfLines={1}>{g.title}</Text>
        <Text style={s.groupDate}>{formatDate(g.date)}</Text>
      </Pressable>
      <View style={s.moments}>
        {g.moments.map((m) => (
          <MomentRow
            key={m.index}
            peak={m}
            twitchVodId={g.twitchVodId}
            onMake={() => make(g.id, m.index)}
            busy={busy === `${g.id}-${m.index}`}
            disabled={clipBusy || (busy !== null && busy !== `${g.id}-${m.index}`)}
          />
        ))}
      </View>
    </View>
  );

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <PageTitle>Clips</PageTitle>
      {!nothing && (
        <Text style={s.sum}>
          {toPost.length} ready to post {'·'} {momentCount} {momentCount === 1 ? 'moment' : 'moments'} not clipped yet
        </Text>
      )}
      {error ? <Text style={[s.small, { color: colors.danger }]}>{error}</Text> : null}

      {nothing ? (
        <View style={s.empty}>
          <Text style={s.emptyTitle}>No clips yet.</Text>
          <Text style={s.emptySub}>Every stream you analyze comes back with the moments worth clipping. They show up here.</Text>
          <Button title="Analyze a stream" onPress={() => router.push('/(tabs)/vods')} style={{ alignSelf: 'flex-start' }} />
        </View>
      ) : (
        <>
          {(toPost.length > 0 || making.length > 0) && (
            <View style={s.section}>
              <SectionHead title="Ready to post" meta={toPost.length > 0 ? `${toPost.length} waiting` : undefined} />
              {!youTube && toPost.length > 0 && (
                <Text style={[s.small, { marginTop: 0, marginBottom: 14 }]}>
                  Save or share them from the clip page. To post Shorts in one tap, connect YouTube on{' '}
                  <Text style={s.link} onPress={() => Linking.openURL('https://levlcast.com/dashboard/settings#connections')}>
                    levlcast.com
                  </Text>
                  .
                </Text>
              )}
              <View style={s.grid}>
                {making.map((c) => (
                  <ClipCard key={c.id} clip={c} onPress={() => {}} />
                ))}
                {toPost.map((c) => (
                  <ClipCard key={c.id} clip={c} from={vodTitle.get(c.vod_id)} onPress={() => router.push(`/clip/${c.id}`)} />
                ))}
              </View>
            </View>
          )}

          {failed.length > 0 && (
            <View style={s.section}>
              <SectionHead title="Didn't render" meta="Try again, it usually works" />
              {failed.map((c) => (
                <View key={c.id} style={s.failed}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.failedTitle} numberOfLines={2}>{c.title || 'Clip'}</Text>
                    <Text style={s.failedWhy} numberOfLines={2}>{c.failed_reason || "It didn't render."}</Text>
                  </View>
                  <View style={{ gap: 8 }}>
                    <Button title="Try again" small onPress={() => retry(c)} loading={busy === c.id} disabled={busy !== null && busy !== c.id} />
                    <Button title="Delete" kind="danger" small onPress={() => remove(c)} />
                  </View>
                </View>
              ))}
            </View>
          )}

          {momentCount > 0 && (
            <View style={s.section}>
              <SectionHead title="Moments to clip" meta={`${momentCount} from ${groups.length} ${groups.length === 1 ? 'stream' : 'streams'}`} />
              {clipBusy ? <Text style={[s.small, { marginTop: 0, marginBottom: 12 }]}>Making one clip right now. The buttons come back when it&apos;s done.</Text> : null}
              {groups.slice(0, OPEN_STREAMS).map(renderGroup)}
              {groups.length > OPEN_STREAMS && (
                <>
                  <Pressable onPress={() => setShowOlder((v) => !v)} style={s.fold}>
                    <Text style={s.foldText}>
                      {groups.slice(OPEN_STREAMS).reduce((n, g) => n + g.moments.length, 0)} more from {groups.length - OPEN_STREAMS} older{' '}
                      {groups.length - OPEN_STREAMS === 1 ? 'stream' : 'streams'}
                    </Text>
                    {showOlder ? <ChevronUp size={16} color={colors.ink3} /> : <ChevronDown size={16} color={colors.ink3} />}
                  </Pressable>
                  {showOlder && groups.slice(OPEN_STREAMS).map(renderGroup)}
                </>
              )}
            </View>
          )}

          {done.length > 0 && (
            <View style={s.section}>
              <Pressable onPress={() => setShowPosted((v) => !v)} style={s.fold}>
                <Text style={s.foldText}>Posted {'·'} {done.length}</Text>
                {showPosted ? <ChevronUp size={16} color={colors.ink3} /> : <ChevronDown size={16} color={colors.ink3} />}
              </Pressable>
              {showPosted && (
                <View style={[s.grid, { marginTop: 16 }]}>
                  {done.map((c) => {
                    const url = posted.get(c.id) ?? null;
                    return (
                      <ClipCard
                        key={c.id}
                        clip={c}
                        from={vodTitle.get(c.vod_id)}
                        postedUrl={url ?? 'posted'}
                        onPress={() => router.push(`/clip/${c.id}`)}
                        onOpenPosted={() => url && Linking.openURL(url)}
                      />
                    );
                  })}
                </View>
              )}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  sum: { marginTop: 8, fontFamily: fonts.mono, fontSize: 12, letterSpacing: 0.6, color: colors.ink3 },
  small: { marginTop: 10, fontSize: 13, lineHeight: 19, color: colors.ink3 },
  link: { color: colors.ink, fontWeight: '600', textDecorationLine: 'underline' },
  section: { marginTop: 30 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, rowGap: 22 },
  failed: { flexDirection: 'row', gap: 14, paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.line },
  failedTitle: { fontSize: 14.5, fontWeight: '600', color: colors.ink },
  failedWhy: { marginTop: 3, fontSize: 13, lineHeight: 18, color: colors.danger },
  group: { marginBottom: 14 },
  groupHead: { flexDirection: 'row', alignItems: 'baseline', gap: 12, marginBottom: 8 },
  groupTitle: { flex: 1, fontFamily: fonts.display, fontSize: 16, letterSpacing: -0.2, color: colors.ink },
  groupDate: { fontFamily: fonts.mono, fontSize: 11, color: colors.ink4 },
  moments: { borderTopWidth: 1, borderTopColor: colors.line },
  fold: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
  foldText: { fontSize: 14, fontWeight: '600', color: colors.ink2 },
  empty: { marginTop: 24, paddingVertical: 28, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
  emptyTitle: { fontFamily: fonts.display, fontSize: 22, lineHeight: 29, letterSpacing: -0.4, color: colors.ink },
  emptySub: { marginTop: 8, marginBottom: 20, fontSize: 15, lineHeight: 22, color: colors.ink2 },
});
