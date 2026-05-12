/**
 * Mobile clip editor — frame picker, caption-style picker, per-card caption
 * editing, save & re-export. Hits the same /api/clips/[id]/edit endpoint the
 * web editor uses. Trim sliders + video preview deferred to 1.0.4 (need
 * native deps).
 */
import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Image, Alert, Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/colors';

const APP_URL = process.env.EXPO_PUBLIC_APP_URL!;

const CAPTION_STYLES: Array<{ id: string; label: string; desc: string }> = [
  { id: 'bold',    label: 'Bold',    desc: 'White text, hard black stroke' },
  { id: 'boxed',   label: 'Boxed',   desc: 'White text in a black box' },
  { id: 'minimal', label: 'Minimal', desc: 'Thin sans, no background' },
  { id: 'classic', label: 'Classic', desc: 'Yellow Twitch-style' },
  { id: 'neon',    label: 'Neon',    desc: 'Glowing accent' },
  { id: 'fire',    label: 'Fire',    desc: 'Orange-to-red gradient' },
  { id: 'impact',  label: 'Impact',  desc: 'Heavy display caps' },
];

interface CaptionCard { start: number; end: number; text: string; }
interface Clip {
  id: string;
  title: string;
  caption_text: string | null;
  caption_style: string | null;
  video_url: string | null;
  source_video_url: string | null;
  candidate_frames: string[] | null;
  thumbnail_url: string | null;
  start_time_seconds: number;
  end_time_seconds: number;
  edited_captions: CaptionCard[] | null;
}

export default function ClipEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [clip, setClip] = useState<Clip | null>(null);
  const [cards, setCards] = useState<CaptionCard[]>([]);
  const [style, setStyle] = useState<string>('bold');
  const [thumb, setThumb] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      const { data } = await supabase
        .from('clips')
        .select('id, title, caption_text, caption_style, video_url, source_video_url, candidate_frames, thumbnail_url, start_time_seconds, end_time_seconds, edited_captions')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();
      if (!data) { Alert.alert('Clip not found'); router.back(); return; }
      const c = data as Clip;
      setClip(c);
      setStyle(c.caption_style ?? 'bold');
      setThumb(c.thumbnail_url ?? null);

      // Build editable caption cards — prefer prior edits, otherwise split
      // the single caption_text into one card spanning the whole clip.
      if (c.edited_captions && c.edited_captions.length > 0) {
        setCards(c.edited_captions);
      } else if (c.caption_text) {
        const dur = c.end_time_seconds - c.start_time_seconds;
        setCards([{ start: 0, end: dur, text: c.caption_text }]);
      } else {
        setCards([]);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function extractFrames() {
    if (!id || extracting) return;
    setExtracting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${APP_URL}/api/clips/${id}/frames`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Frame extraction failed');
      }
      await load();
    } catch (e: any) {
      Alert.alert('Frames unavailable', e?.message || 'Could not extract frame candidates.');
    } finally {
      setExtracting(false);
    }
  }

  async function save() {
    if (!clip || saving) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const body: Record<string, unknown> = {
        captionStyle: style,
        editedCaptions: cards.filter((c) => c.text.trim().length > 0),
      };
      if (thumb && clip.candidate_frames?.includes(thumb)) body.thumbnailUrl = thumb;

      const res = await fetch(`${APP_URL}/api/clips/${id}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Save failed');
      Alert.alert('Saved', 'Your clip is re-rendering and will be ready in a minute.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Try again.');
    } finally {
      setSaving(false);
    }
  }

  function updateCard(i: number, text: string) {
    setCards((prev) => prev.map((c, idx) => (idx === i ? { ...c, text } : c)));
  }

  function shareClip() {
    if (!clip?.video_url) return;
    Share.share({ message: `${clip.title}\n${clip.video_url}` });
  }

  if (loading || !clip) {
    return <View style={s.center}><ActivityIndicator color={colors.accentLight} /></View>;
  }

  const frames = clip.candidate_frames ?? [];

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.title} numberOfLines={2}>{clip.title}</Text>
      <Text style={s.sub}>Edit captions, swap the thumbnail, change the style. Saves re-render in seconds and don&apos;t cost a clip from your quota.</Text>

      {/* Thumbnail preview */}
      {thumb ? (
        <Image source={{ uri: thumb }} style={s.preview} />
      ) : clip.thumbnail_url ? (
        <Image source={{ uri: clip.thumbnail_url }} style={s.preview} />
      ) : (
        <View style={[s.preview, s.previewFallback]}>
          <Text style={s.previewFallbackText}>No thumbnail</Text>
        </View>
      )}

      {/* Frame picker */}
      <Text style={s.sectionLabel}>HOOK FRAME</Text>
      {frames.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.frameRow}>
          {frames.map((url) => (
            <TouchableOpacity key={url} onPress={() => setThumb(url)} style={[s.frameThumb, thumb === url && s.frameThumbActive]}>
              <Image source={{ uri: url }} style={s.frameThumbImg} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <TouchableOpacity style={s.extractBtn} onPress={extractFrames} disabled={extracting}>
          {extracting
            ? <ActivityIndicator size="small" color={colors.text} />
            : <Text style={s.extractBtnText}>Generate frame options</Text>
          }
        </TouchableOpacity>
      )}

      {/* Caption style picker */}
      <Text style={s.sectionLabel}>CAPTION STYLE</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow}>
        {CAPTION_STYLES.map((opt) => (
          <TouchableOpacity
            key={opt.id}
            onPress={() => setStyle(opt.id)}
            style={[s.chip, style === opt.id && s.chipActive]}
          >
            <Text style={[s.chipText, style === opt.id && s.chipTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <Text style={s.chipHint}>{CAPTION_STYLES.find((c) => c.id === style)?.desc}</Text>

      {/* Caption text cards */}
      <Text style={s.sectionLabel}>CAPTION TEXT</Text>
      {cards.length === 0 && (
        <Text style={s.muted}>No captions on this clip yet.</Text>
      )}
      {cards.map((c, i) => (
        <View key={i} style={s.cardEditor}>
          <Text style={s.cardTime}>{c.start.toFixed(1)}s → {c.end.toFixed(1)}s</Text>
          <TextInput
            value={c.text}
            onChangeText={(t) => updateCard(i, t)}
            multiline
            maxLength={60}
            placeholder="Caption text"
            placeholderTextColor={colors.muted}
            style={s.cardInput}
          />
          <Text style={s.cardCount}>{c.text.length}/60</Text>
        </View>
      ))}

      {/* Save */}
      <TouchableOpacity style={s.saveBtn} onPress={save} disabled={saving}>
        {saving
          ? <ActivityIndicator color="#fff" />
          : <Text style={s.saveBtnText}>Save &amp; re-render</Text>
        }
      </TouchableOpacity>

      {clip.video_url && (
        <TouchableOpacity style={s.shareBtn} onPress={shareClip}>
          <Text style={s.shareBtnText}>Share current version</Text>
        </TouchableOpacity>
      )}

      <Text style={s.foot}>
        Vertical 9:16 export is on the web for this build. We&apos;ll add it to mobile in 1.0.4.
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 80 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },

  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 4 },
  sub: { fontSize: 13, color: colors.muted, marginBottom: 16, lineHeight: 18 },

  preview: { width: '100%', aspectRatio: 16 / 9, borderRadius: 12, marginBottom: 18, backgroundColor: colors.surface2 },
  previewFallback: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  previewFallbackText: { color: colors.muted, fontSize: 13 },

  sectionLabel: { fontSize: 11, fontWeight: '800', color: colors.muted, letterSpacing: 1.2, marginBottom: 8, marginTop: 6 },

  frameRow: { flexGrow: 0, marginBottom: 8 },
  frameThumb: { width: 96, height: 54, borderRadius: 8, marginRight: 10, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  frameThumbActive: { borderColor: colors.accent },
  frameThumbImg: { width: '100%', height: '100%' },
  extractBtn: { backgroundColor: colors.surface, borderRadius: 10, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
  extractBtnText: { fontSize: 14, color: colors.accentLight, fontWeight: '600' },

  chipRow: { flexGrow: 0, marginBottom: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginRight: 8 },
  chipActive: { backgroundColor: 'rgba(155,106,255,0.16)', borderColor: colors.accent },
  chipText: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  chipTextActive: { color: colors.accentLight },
  chipHint: { fontSize: 12, color: colors.muted, marginBottom: 16, marginLeft: 2 },

  muted: { color: colors.muted, fontSize: 13, marginBottom: 8 },
  cardEditor: { backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 10 },
  cardTime: { fontSize: 11, color: colors.muted, fontWeight: '700', letterSpacing: 0.6, marginBottom: 6 },
  cardInput: { fontSize: 15, color: colors.text, lineHeight: 22, minHeight: 44, padding: 0, textAlignVertical: 'top' },
  cardCount: { fontSize: 10, color: colors.muted, alignSelf: 'flex-end', marginTop: 4 },

  saveBtn: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  shareBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 8 },
  shareBtnText: { color: colors.accentLight, fontSize: 14, fontWeight: '600' },

  foot: { fontSize: 11, color: colors.muted, textAlign: 'center', marginTop: 18, lineHeight: 16 },
});
