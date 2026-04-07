import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/colors';

function scoreColor(score: number) {
  if (score >= 80) return colors.green;
  if (score >= 60) return colors.yellow;
  return colors.red;
}

function statusColor(status: string) {
  switch (status) {
    case 'ready': return colors.green;
    case 'transcribing':
    case 'analyzing': return colors.yellow;
    case 'failed': return colors.red;
    default: return colors.muted;
  }
}

export default function VodsScreen() {
  const [vods, setVods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const router = useRouter();

  const loadVods = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('vods')
      .select('*')
      .eq('user_id', user.id)
      .order('stream_date', { ascending: false });
    setVods(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadVods(); }, [loadVods]);

  // Auto-poll every 8s while any VOD is processing
  useEffect(() => {
    const hasProcessing = vods.some(v => v.status === 'transcribing' || v.status === 'analyzing');
    if (!hasProcessing) return;
    const interval = setInterval(loadVods, 8000);
    return () => clearInterval(interval);
  }, [vods, loadVods]);

  async function syncVods() {
    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${process.env.EXPO_PUBLIC_APP_URL}/api/twitch/vods`, {
        method: 'POST',
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (!res.ok) throw new Error('Sync failed');
      await loadVods();
    } catch {
      Alert.alert('Sync failed', 'Could not sync VODs. Try again.');
    } finally {
      setSyncing(false);
    }
  }

  async function analyzeVod(vodId: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setVods(prev => prev.map(v => v.id === vodId ? { ...v, status: 'transcribing' } : v));

    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_APP_URL}/api/vods/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ vodId }),
      });

      const json = await res.json();
      if (json.upgrade) {
        router.push('/subscribe');
      } else {
        await loadVods();
      }
    } catch {
      Alert.alert('Analysis failed', 'Could not analyze this VOD.');
      await loadVods();
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.accentLight} /></View>;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={vods}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={syncing} onRefresh={loadVods} tintColor={colors.accentLight} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>VODs</Text>
              <Text style={styles.sub}>Analyze your streams for coaching reports.</Text>
            </View>
            <TouchableOpacity style={styles.syncBtn} onPress={syncVods} disabled={syncing}>
              {syncing ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.syncBtnText}>Sync</Text>}
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No VODs yet. Tap Sync to pull your recent streams.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.vodCard}
            onPress={() => item.status === 'ready' && router.push(`/vod/${item.id}`)}
            activeOpacity={item.status === 'ready' ? 0.7 : 1}
          >
            <View style={styles.vodInfo}>
              <Text style={styles.vodTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.vodMeta}>
                {new Date(item.stream_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
              <View style={styles.vodFooter}>
                <View style={[styles.statusDot, { backgroundColor: statusColor(item.status) }]} />
                <Text style={[styles.statusText, { color: statusColor(item.status) }]}>{item.status}</Text>
                {(item.status === 'pending' || item.status === 'failed') && (
                  <TouchableOpacity style={styles.analyzeBtn} onPress={() => analyzeVod(item.id)}>
                    <Text style={styles.analyzeBtnText}>{item.status === 'failed' ? 'Retry' : 'Analyze'}</Text>
                  </TouchableOpacity>
                )}
                {item.status === 'ready' && (
                  <>
                    {(item.coach_report as any)?.overall_score !== undefined && (
                      <Text style={[styles.scoreChip, { color: scoreColor((item.coach_report as any).overall_score) }]}>
                        {(item.coach_report as any).overall_score}/100
                      </Text>
                    )}
                    <Text style={styles.viewReport}>View Report →</Text>
                  </>
                )}
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  list: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  sub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  syncBtn: { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  syncBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: colors.muted, textAlign: 'center', lineHeight: 22 },
  vodCard: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 12 },
  vodInfo: { flex: 1 },
  vodTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 6, lineHeight: 20 },
  vodMeta: { fontSize: 12, color: colors.muted, marginBottom: 10 },
  vodFooter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize', flex: 1 },
  analyzeBtn: { backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  analyzeBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  viewReport: { fontSize: 12, color: colors.accentLight, fontWeight: '600' },
  scoreChip: { fontSize: 13, fontWeight: '800' },
});
