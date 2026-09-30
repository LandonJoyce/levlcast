/**
 * One clip: watch it, share it, post it, and the quick edits (captions,
 * caption style, cover frame) through the same /api/clips/[id]/edit the
 * site's editor uses. Trimming, the facecam layout and the 9:16 download
 * live in the site's editor.
 */
import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Linking, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowUpRight, Film, Play } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';
import { Button, Label, Loading, Screen, alpha } from '@/lib/ui';
import { categoryLabel } from '@/components/Moments';
import { clock } from '@/lib/time';
import { api, confirmDeleteClip, postToYouTube } from '@/lib/api';

const MAX_CAPTION = 60;

/** The site's caption styles, drawn roughly the way the renderer burns them. */
const CAPTION_STYLES: Array<{ id: string; label: string; color: string; stroke: string; boxed?: boolean; light?: boolean }> = [
  { id: 'bold', label: 'Bold', color: '#FFFFFF', stroke: '#000000' },
  { id: 'classic', label: 'Classic', color: '#FFE600', stroke: '#000000' },
  { id: 'fire', label: 'Fire', color: '#FF6B00', stroke: '#1A0000' },
  { id: 'neon', label: 'Neon', color: '#00EEFF', stroke: '#003344' },
  { id: 'impact', label: 'Impact', color: '#FFFFFF', stroke: '#000000' },
  { id: 'boxed', label: 'Boxed', color: '#FFFFFF', stroke: 'transparent', boxed: true },
  { id: 'minimal', label: 'Minimal', color: '#FFFFFF', stroke: 'transparent', light: true },
];

interface CaptionCard {
  start: number;
  end: number;
  text: string;
}

interface Clip {
  id: string;
  vod_id: string;
  title: string | null;
  status: string;
  caption_text: string | null;
  caption_style: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  candidate_frames: string[] | null;
  start_time_seconds: number;
  end_time_seconds: number;
  edited_captions: CaptionCard[] | null;
  peak_category: string | null;
  is_highlight_reel: boolean | null;
}

export default function ClipScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [clip, setClip] = useState<Clip | null>(null);
  const [streamTitle, setStreamTitle] = useState<string | null>(null);
  const [postedUrl, setPostedUrl] = useState<string | null | undefined>(undefined);
  const [youTube, setYouTube] = useState(false);
  const [cards, setCards] = useState<CaptionCard[]>([]);
  const [style, setStyle] = useState('bold');
  const [thumb, setThumb] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }
      const { data } = await supabase
        .from('clips')
        .select('id, vod_id, title, status, caption_text, caption_style, video_url, thumbnail_url, candidate_frames, start_time_seconds, end_time_seconds, edited_captions, peak_category, is_highlight_reel')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!data) {
        Alert.alert('Clip not found');
        router.back();
        return;
      }
      const c = data as Clip;
      const [vodRes, postRes, connRes] = await Promise.all([
        supabase.from('vods').select('title').eq('id', c.vod_id).maybeSingle(),
        supabase.from('social_posts').select('platform_url').eq('user_id', user.id).eq('platform', 'youtube').eq('clip_id', c.id).limit(1),
        supabase.from('social_connections').select('platform').eq('user_id', user.id),
      ]);
      setClip(c);
      setStreamTitle((vodRes.data as any)?.title ?? null);
      const post = (postRes.data ?? [])[0] as any;
      setPostedUrl(post ? post.platform_url ?? null : undefined);
      setYouTube((connRes.data ?? []).some((x: any) => x.platform === 'youtube'));
      setStyle(c.caption_style ?? 'bold');
      setThumb(c.thumbnail_url ?? null);
      // Editable caption cards: earlier edits, or the one caption across the whole clip.
      if (c.edited_captions && c.edited_captions.length > 0) setCards(c.edited_captions);
      else if (c.caption_text) setCards([{ start: 0, end: c.end_time_seconds - c.start_time_seconds, text: c.caption_text }]);
      else setCards([]);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  async function extractFrames() {
    if (!id || extracting) return;
    setExtracting(true);
    const r = await api(`/api/clips/${id}/frames`, { method: 'POST' });
    setExtracting(false);
    if (!r.ok) {
      Alert.alert('Frames unavailable', r.data?.error || "Couldn't pull cover frames from this clip.");
      return;
    }
    load();
  }

  async function save() {
    if (!clip || saving) return;
    setSaving(true);
    const body: Record<string, unknown> = {
      captionStyle: style,
      editedCaptions: cards.filter((c) => c.text.trim().length > 0),
    };
    if (thumb && clip.candidate_frames?.includes(thumb)) body.thumbnailUrl = thumb;
    const r = await api(`/api/clips/${id}/edit`, { body });
    setSaving(false);
    if (!r.ok) {
      Alert.alert("Couldn't save", r.data?.error || 'Try again in a minute.');
      return;
    }
    Alert.alert('Saved', "It's re-rendering and will be ready in a minute.", [{ text: 'OK', onPress: () => router.back() }]);
  }

  async function post() {
    if (!clip) return;
    setPosting(true);
    const url = await postToYouTube(clip.id, () => router.push('/subscribe'));
    setPosting(false);
    if (url) {
      setPostedUrl(url);
      Alert.alert('Posted', "It's live on YouTube.", [
        { text: 'View', onPress: () => Linking.openURL(url) },
        { text: 'OK' },
      ]);
    }
  }

  async function remove() {
    if (!clip) return;
    const gone = await confirmDeleteClip(clip.id);
    if (gone) router.back();
  }

  function share() {
    if (!clip?.video_url) return;
    Share.share({ message: clip.caption_text ? `${clip.title ?? ''}\n${clip.caption_text}` : clip.title ?? '', url: clip.video_url }).catch(() => {});
  }

  if (loading || !clip) return <Loading />;

  const frames = clip.candidate_frames ?? [];
  const length = clock(clip.end_time_seconds - clip.start_time_seconds);
  const cover = thumb ?? clip.thumbnail_url;

  return (
    <Screen inset={false}>
      <Pressable
        onPress={() => clip.video_url && Linking.openURL(clip.video_url)}
        disabled={!clip.video_url}
        style={s.preview}
        accessibilityLabel="Play the clip"
      >
        {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <Film size={28} color={colors.ink4} />}
        {clip.video_url ? (
          <View style={s.play}>
            <Play size={22} color={colors.bg} fill={colors.bg} />
          </View>
        ) : null}
        <Text style={s.len}>{length}</Text>
      </Pressable>

      <Text style={s.title}>{clip.title || (clip.is_highlight_reel ? 'Highlight reel' : 'Untitled clip')}</Text>
      <Text style={s.from} numberOfLines={1}>
        {[categoryLabel(clip.peak_category), streamTitle].filter(Boolean).join(' · ')}
      </Text>

      <View style={s.actions}>
        <Button title="Watch" onPress={() => clip.video_url && Linking.openURL(clip.video_url)} disabled={!clip.video_url} style={{ flex: 1 }} />
        <Button title="Share" kind="ghost" onPress={share} disabled={!clip.video_url} style={{ flex: 1 }} />
      </View>
      {postedUrl !== undefined ? (
        <Pressable onPress={() => postedUrl && Linking.openURL(postedUrl)} style={s.posted} hitSlop={6}>
          <Text style={s.postedText}>On YouTube</Text>
          <ArrowUpRight size={13} color={colors.green} />
        </Pressable>
      ) : youTube ? (
        <Button title="Post to YouTube Shorts" kind="ghost" onPress={post} loading={posting} style={{ marginTop: 10 }} />
      ) : (
        <Text style={s.note}>
          To post Shorts in one tap, connect YouTube on{' '}
          <Text style={s.link} onPress={() => Linking.openURL('https://levlcast.com/dashboard/settings#connections')}>
            levlcast.com
          </Text>
          .
        </Text>
      )}

      <View style={s.divider} />

      <Label style={s.k}>Cover frame</Label>
      {frames.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 10 }}>
          {frames.map((url) => (
            <Pressable key={url} onPress={() => setThumb(url)} style={[s.frame, thumb === url && { borderColor: colors.ink }]}>
              <Image source={{ uri: url }} style={s.frameImg} />
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <Button title="Pull cover frames" kind="ghost" onPress={extractFrames} loading={extracting} style={{ alignSelf: 'flex-start' }} />
      )}

      <Label style={[s.k, { marginTop: 26 }]}>Caption style</Label>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 10 }}>
        {CAPTION_STYLES.map((o) => {
          const on = style === o.id;
          return (
            <Pressable key={o.id} onPress={() => setStyle(o.id)} style={[s.styleTile, on && { borderColor: colors.ink }]}>
              <View style={s.styleSample}>
                <Text
                  style={[
                    s.sampleText,
                    { color: o.color },
                    o.light && { fontWeight: '500', letterSpacing: 0.5 },
                    o.boxed && { backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 2 },
                    o.stroke !== 'transparent' && { textShadowColor: o.stroke, textShadowOffset: { width: 1.5, height: 1.5 }, textShadowRadius: 1 },
                  ]}
                >
                  CAPTION
                </Text>
              </View>
              <Text style={[s.styleLabel, on && { color: colors.ink }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Label style={[s.k, { marginTop: 26 }]}>Caption text</Label>
      {cards.length === 0 && <Text style={s.note}>No captions on this clip yet.</Text>}
      {cards.map((c, i) => (
        <View key={i} style={s.card}>
          <Text style={s.cardTime}>
            {c.start.toFixed(1)}s {'→'} {c.end.toFixed(1)}s
          </Text>
          <TextInput
            value={c.text}
            onChangeText={(t) => setCards((prev) => prev.map((x, idx) => (idx === i ? { ...x, text: t } : x)))}
            multiline
            maxLength={MAX_CAPTION}
            placeholder="Caption text"
            placeholderTextColor={colors.ink4}
            style={s.input}
          />
          <Text style={[s.count, c.text.length >= MAX_CAPTION && { color: colors.warn }]}>
            {c.text.length}/{MAX_CAPTION}
          </Text>
        </View>
      ))}

      <Button title="Save and re-render" onPress={save} loading={saving} style={{ marginTop: 22 }} />
      <Text style={s.foot}>Edits don&apos;t use a clip from your monthly count. Trimming, the facecam layout and the 9:16 download are in the editor on levlcast.com.</Text>

      <Button title="Delete clip" kind="danger" onPress={remove} style={{ marginTop: 28 }} />
    </Screen>
  );
}

const s = StyleSheet.create({
  preview: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#1A1516',
    alignItems: 'center',
    justifyContent: 'center',
  },
  play: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha(colors.ink, 0.92),
    paddingLeft: 3,
  },
  len: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: 'rgba(8,6,7,0.72)',
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.ink,
  },
  title: { marginTop: 18, fontFamily: fonts.display, fontSize: 21, lineHeight: 27, letterSpacing: -0.4, color: colors.ink },
  from: { marginTop: 6, fontSize: 13, color: colors.ink3 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  posted: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 14, alignSelf: 'flex-start' },
  postedText: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.green },
  note: { marginTop: 12, fontSize: 13, lineHeight: 19, color: colors.ink3 },
  link: { color: colors.ink, fontWeight: '600', textDecorationLine: 'underline' },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 26 },
  k: { marginBottom: 12 },
  frame: { width: 112, height: 63, borderRadius: 8, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  frameImg: { width: '100%', height: '100%' },
  styleTile: { width: 96, borderRadius: 10, borderWidth: 1, borderColor: colors.line, overflow: 'hidden', backgroundColor: colors.surface },
  styleSample: { height: 54, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0E0E0E' },
  sampleText: { fontSize: 13, fontWeight: '900', letterSpacing: 0.4 },
  styleLabel: { paddingVertical: 7, textAlign: 'center', fontSize: 12, fontWeight: '600', color: colors.ink3 },
  card: { padding: 12, marginBottom: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  cardTime: { marginBottom: 6, fontFamily: fonts.mono, fontSize: 11, color: colors.ink4 },
  input: { minHeight: 44, padding: 0, fontSize: 15, lineHeight: 22, color: colors.ink, textAlignVertical: 'top' },
  count: { alignSelf: 'flex-end', marginTop: 4, fontFamily: fonts.mono, fontSize: 10, color: colors.ink4 },
  foot: { marginTop: 12, fontSize: 12.5, lineHeight: 18, color: colors.ink4 },
});
