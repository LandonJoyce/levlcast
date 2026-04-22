import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Linking, RefreshControl, Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Film, Scissors, Sparkles, Clock, Loader2 } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/colors';

const APP_URL = process.env.EXPO_PUBLIC_APP_URL!;

const CATEGORY_LABELS: Record<string, string> = {
  hype: 'Hype', funny: 'Comedy', educational: 'Educational',
  emotional: 'Emotional', clutch_play: 'Clutch Plays', rage: 'Rage', wholesome: 'Wholesome',
};

function categoryStyle(category: string) {
  switch (category) {
    case 'hype': return { bg: 'rgba(168,85,247,0.12)', text: '#c084fc' };
    case 'funny': return { bg: 'rgba(234,179,8,0.12)', text: '#facc15' };
    case 'emotional': return { bg: 'rgba(239,68,68,0.12)', text: '#f87171' };
    case 'educational': return { bg: 'rgba(59,130,246,0.12)', text: '#60a5fa' };
    default: return { bg: 'rgba(255,255,255,0.06)', text: colors.muted };
  }
}

function scoreColor(score: number) {
  if (score >= 0.7) return colors.green;
  if (score >= 0.4) return colors.yellow;
  return colors.red;
}

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function ClipsScreen() {
  const [readyClips, setReadyClips] = useState<any[]>([]);
  const [processingClips, setProcessingClips] = useState<any[]>([]);
  const [failedClips, setFailedClips] = useState<any[]>([]);
  const [peaks, setPeaks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const router = useRouter();

  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }

      const [clipsRes, vodsRes] = await Promise.all([
        supabase.from('clips').select('*').eq('user_id', user.id)
          .in('status', ['ready', 'processing', 'failed'])
          .order('created_at', { ascending: false }),
        supabase.from('vods').select('id, title, twitch_vod_id, thumbnail_url, peak_data')
          .eq('user_id', user.id).eq('status', 'ready')
          .not('peak_data', 'is', null)
          .order('stream_date', { ascending: false }),
      ]);

      const all = clipsRes.data || [];
      setReadyClips(all.filter((c) => c.status === 'ready'));
      setProcessingClips(all.filter((c) => c.status === 'processing'));
      setFailedClips(all.filter((c) => c.status === 'failed'));

      // Build ungenerated peaks
      const generatedKeys = new Set(
        all.filter((c) => c.status === 'ready' || c.status === 'processing')
          .map((c) => `${c.vod_id}-${c.start_time_seconds}`)
      );
      const ungeneratedPeaks: any[] = [];
      for (const vod of vodsRes.data || []) {
        for (let pi = 0; pi < (vod.peak_data || []).length; pi++) {
          const p = vod.peak_data[pi];
          const key = `${vod.id}-${Math.round(p.start)}`;
          if (!generatedKeys.has(key)) {
            ungeneratedPeaks.push({ ...p, vodId: vod.id, vodTitle: vod.title, vodThumbnail: vod.thumbnail_url, peakIndex: pi });
          }
        }
      }
      ungeneratedPeaks.sort((a, b) => b.score - a.score);
      setPeaks(ungeneratedPeaks);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to load clips');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadData();
  }, [loadData]));

  // Auto-poll while clips are processing
  useFocusEffect(useCallback(() => {
    if (processingClips.length === 0) return;
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, [processingClips.length, loadData]));

  async function generateClip(vodId: string, peakIndex: number) {
    const key = `${vodId}-${peakIndex}`;
    setGenerating(key);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${APP_URL}/api/clips/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ vodId, peakIndex }),
      });
      const json = await res.json();
      if (res.status === 403) {
        Alert.alert('Limit reached', json.message || 'Upgrade to Pro for more clips.');
        return;
      }
      if (!res.ok) { Alert.alert('Error', json.error || 'Failed to queue clip'); return; }
      await loadData();
    } catch {
      Alert.alert('Error', 'Network error — try again');
    } finally {
      setGenerating(null);
    }
  }

  async function regenerateClip(clipId: string, vodId: string, startSeconds: number) {
    setGenerating(clipId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${APP_URL}/api/clips/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ clipId, vodId, startSeconds }),
      });
      const json = await res.json();
      if (!res.ok) { Alert.alert('Error', json.error || 'Failed'); return; }
      await loadData();
    } catch {
      Alert.alert('Error', 'Network error — try again');
    } finally {
      setGenerating(null);
    }
  }

  async function deleteClip(clipId: string) {
    Alert.alert('Delete clip?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return;
          await fetch(`${APP_URL}/api/clips/${clipId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          await loadData();
        },
      },
    ]);
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.accentLight} /></View>;
  }

  const hasContent = readyClips.length > 0 || processingClips.length > 0 || failedClips.length > 0 || peaks.length > 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.accentLight} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Clips</Text>
        <Text style={styles.subtitle}>Your best moments, ready to post.</Text>
      </View>

      {!hasContent ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}><Scissors size={24} color={colors.accentLight} /></View>
          <Text style={styles.emptyTitle}>No clips yet</Text>
          <Text style={styles.emptySub}>Analyze a VOD to detect peak moments. Each peak becomes a potential clip.</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(tabs)/vods')}>
            <Film size={15} color="#fff" />
            <Text style={styles.emptyBtnText}>Go to VODs</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Processing */}
          {processingClips.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Generating ({processingClips.length})</Text>
              {processingClips.map((clip) => (
                <View key={clip.id} style={styles.processingCard}>
                  <ActivityIndicator size="small" color={colors.accentLight} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.clipTitle}>{clip.title}</Text>
                    <Text style={styles.clipSub}>Processing in background…</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Failed */}
          {failedClips.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Failed ({failedClips.length})</Text>
              {failedClips.map((clip) => (
                <View key={clip.id} style={styles.failedCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.clipTitle}>{clip.title}</Text>
                    <Text style={styles.failedReason}>{clip.failed_reason || 'Generation failed — regenerate or delete.'}</Text>
                  </View>
                  <View style={styles.failedActions}>
                    <TouchableOpacity
                      style={styles.regenBtn}
                      onPress={() => regenerateClip(clip.id, clip.vod_id, clip.start_time_seconds)}
                      disabled={!!generating}
                    >
                      {generating === clip.id
                        ? <ActivityIndicator size="small" color={colors.accentLight} />
                        : <Text style={styles.regenBtnText}>Retry</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteClip(clip.id)}>
                      <Text style={styles.deleteBtnText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Ready clips */}
          {readyClips.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Ready ({readyClips.length})</Text>
              {readyClips.map((clip) => (
                <View key={clip.id} style={styles.readyCard}>
                  <Text style={styles.clipTitle}>{clip.title}</Text>
                  {clip.caption_text ? (
                    <Text style={styles.captionPreview} numberOfLines={2}>{clip.caption_text}</Text>
                  ) : null}
                  <View style={styles.readyActions}>
                    <TouchableOpacity
                      style={styles.watchBtn}
                      onPress={() => clip.video_url && Linking.openURL(clip.video_url)}
                    >
                      <Text style={styles.watchBtnText}>Watch</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteClip(clip.id)}>
                      <Text style={styles.deleteBtnText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Detected peaks */}
          {peaks.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Detected Peaks ({peaks.length})</Text>
              {peaks.map((peak, i) => {
                const catStyle = categoryStyle(peak.category);
                const genKey = `${peak.vodId}-${peak.peakIndex}`;
                return (
                  <View key={`${peak.vodId}-${peak.start}-${i}`} style={styles.peakCard}>
                    <View style={styles.peakRow}>
                      {peak.vodThumbnail ? (
                        <Image source={{ uri: peak.vodThumbnail }} style={styles.peakThumb} />
                      ) : (
                        <View style={[styles.peakThumb, styles.peakThumbFallback]}>
                          <Film size={16} color={colors.muted} />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <View style={styles.peakTitleRow}>
                          <Text style={styles.peakTitle} numberOfLines={2}>{peak.title}</Text>
                          <View style={styles.scoreChip}>
                            <Sparkles size={11} color={scoreColor(peak.score)} />
                            <Text style={[styles.scoreText, { color: scoreColor(peak.score) }]}>
                              {Math.round(peak.score * 100)}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.peakReason} numberOfLines={2}>{peak.reason}</Text>
                        <View style={styles.peakMeta}>
                          <View style={[styles.catChip, { backgroundColor: catStyle.bg }]}>
                            <Text style={[styles.catText, { color: catStyle.text }]}>
                              {CATEGORY_LABELS[peak.category] || peak.category}
                            </Text>
                          </View>
                          <View style={styles.timeChip}>
                            <Clock size={10} color={colors.muted} />
                            <Text style={styles.timeText}>
                              {formatDuration(Math.round(peak.start))} – {formatDuration(Math.round(peak.end))}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.fromVod} numberOfLines={1}>from: {peak.vodTitle}</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[styles.generateBtn, !!generating && styles.generateBtnDisabled]}
                      onPress={() => generateClip(peak.vodId, peak.peakIndex)}
                      disabled={!!generating}
                    >
                      {generating === genKey
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={styles.generateBtnText}>Generate Clip</Text>}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  header: { marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, letterSpacing: -0.5, marginBottom: 4 },
  subtitle: { fontSize: 13, color: colors.muted },
  emptyCard: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 40, alignItems: 'center' },
  emptyIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(124,58,237,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8 },
  emptySub: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19, marginBottom: 20 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  section: { marginBottom: 28 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 },
  processingCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 10 },
  failedCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', padding: 16, marginBottom: 10 },
  failedReason: { fontSize: 11, color: colors.red, marginTop: 3, lineHeight: 16 },
  failedActions: { gap: 6 },
  readyCard: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 10 },
  readyActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  clipTitle: { fontSize: 14, fontWeight: '700', color: colors.text, lineHeight: 20 },
  clipSub: { fontSize: 11, color: colors.muted, marginTop: 2 },
  captionPreview: { fontSize: 12, color: colors.muted, marginTop: 6, lineHeight: 17 },
  watchBtn: { flex: 1, backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  watchBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  regenBtn: { backgroundColor: 'rgba(124,58,237,0.2)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center', minWidth: 60 },
  regenBtnText: { color: colors.accentLight, fontSize: 12, fontWeight: '700' },
  deleteBtn: { backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center', minWidth: 60 },
  deleteBtnText: { color: colors.red, fontSize: 12, fontWeight: '700' },
  peakCard: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 10 },
  peakRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  peakThumb: { width: 80, height: 45, borderRadius: 8, backgroundColor: colors.bg },
  peakThumbFallback: { alignItems: 'center', justifyContent: 'center' },
  peakTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  peakTitle: { fontSize: 13, fontWeight: '700', color: colors.text, flex: 1, lineHeight: 18 },
  scoreChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  scoreText: { fontSize: 13, fontWeight: '800' },
  peakReason: { fontSize: 11, color: colors.muted, lineHeight: 16, marginBottom: 8 },
  peakMeta: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 6 },
  catChip: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  catText: { fontSize: 10, fontWeight: '600' },
  timeChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  timeText: { fontSize: 10, color: colors.muted },
  fromVod: { fontSize: 10, color: 'rgba(255,255,255,0.3)' },
  generateBtn: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  generateBtnDisabled: { opacity: 0.5 },
  generateBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
