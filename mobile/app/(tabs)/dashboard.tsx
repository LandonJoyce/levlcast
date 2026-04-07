import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/colors';

function scoreColor(score: number) {
  if (score >= 80) return colors.green;
  if (score >= 60) return colors.yellow;
  return colors.red;
}

export default function DashboardScreen() {
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({ vods: 0, analyzed: 0, peaks: 0, clips: 0 });
  const [latestVod, setLatestVod] = useState<any>(null);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const loadData = useCallback(async () => {
    try {
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace('/login'); return; }

    const [profileRes, vodsRes, clipsRes, latestRes, streakRes] = await Promise.all([
      supabase.from('profiles').select('twitch_display_name, twitch_avatar_url, plan').eq('id', user.id).single(),
      supabase.from('vods').select('id, status, peak_data').eq('user_id', user.id),
      supabase.from('clips').select('id').eq('user_id', user.id).eq('status', 'ready'),
      supabase.from('vods').select('id, title, coach_report, stream_date').eq('user_id', user.id).eq('status', 'ready').order('stream_date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('vods').select('status').eq('user_id', user.id).order('stream_date', { ascending: false }).limit(20),
    ]);

    setProfile(profileRes.data);
    setLatestVod(latestRes.data || null);

    // Count consecutive ready VODs from most recent
    const streakVods = streakRes.data || [];
    let count = 0;
    for (const v of streakVods) {
      if (v.status === 'ready') count++;
      else break;
    }
    setStreak(count);

    const vods = vodsRes.data || [];
    const analyzed = vods.filter(v => v.status === 'ready');
    const peaks = analyzed.reduce((sum: number, v: any) => sum + ((v.peak_data as any[])?.length || 0), 0);

    setStats({
      vods: vods.length,
      analyzed: analyzed.length,
      peaks,
      clips: clipsRes.data?.length || 0,
    });
    } catch (err: any) {
      setError(err?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.accentLight} /></View>;
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Couldn't load dashboard</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadData}>
          <Text style={styles.retryBtnText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back</Text>
          <Text style={styles.name}>{profile?.twitch_display_name || '...'}</Text>
        </View>
        {profile?.plan === 'pro' ? (
          <View style={styles.proBadge}><Text style={styles.proBadgeText}>PRO</Text></View>
        ) : (
          <TouchableOpacity style={styles.upgradeBadge} onPress={() => router.push('/subscribe')}>
            <Text style={styles.upgradeBadgeText}>Upgrade</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Latest stream score */}
      {latestVod && (latestVod.coach_report as any)?.overall_score !== undefined && (
        <TouchableOpacity style={styles.scoreCard} onPress={() => router.push(`/vod/${latestVod.id}`)}>
          <Text style={styles.scoreCardLabel}>LAST STREAM</Text>
          <View style={styles.scoreCardRow}>
            <Text style={[styles.scoreCardNumber, { color: scoreColor((latestVod.coach_report as any).overall_score) }]}>
              {(latestVod.coach_report as any).overall_score}
            </Text>
            <View style={styles.scoreCardRight}>
              <Text style={styles.scoreCardTitle} numberOfLines={2}>{latestVod.title}</Text>
              <Text style={styles.scoreCardLink}>View Report →</Text>
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* Streak */}
      {streak >= 2 ? (
        <View style={styles.streakCard}>
          <Text style={styles.streakText}>🔥 {streak} stream streak</Text>
          <Text style={styles.streakSub}>Keep the momentum going</Text>
        </View>
      ) : (
        <View style={styles.streakCard}>
          <Text style={styles.streakText}>Start your streak</Text>
          <Text style={styles.streakSub}>Analyze a stream to begin tracking your consistency</Text>
        </View>
      )}

      {/* Stats grid */}
      <View style={styles.grid}>
        <StatCard label="VODs Synced" value={stats.vods} />
        <StatCard label="Analyzed" value={stats.analyzed} />
        <StatCard label="Peaks Found" value={stats.peaks} />
        <StatCard label="Clips" value={stats.clips} accent />
      </View>

      {/* Quick actions */}
      <Text style={styles.sectionLabel}>Quick Actions</Text>
      <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/vods')}>
        <Text style={styles.actionTitle}>View VODs</Text>
        <Text style={styles.actionSub}>Sync and analyze your recent streams</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/analytics')}>
        <Text style={styles.actionTitle}>Growth Analytics</Text>
        <Text style={styles.actionSub}>See what's driving your follower growth</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <View style={[styles.statCard, accent && styles.statCardAccent]}>
      <Text style={[styles.statValue, accent && styles.statValueAccent]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  greeting: { fontSize: 13, color: colors.muted, marginBottom: 2 },
  name: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  proBadge: { backgroundColor: 'rgba(124,58,237,0.2)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: colors.accentLight },
  proBadgeText: { color: colors.accentLight, fontSize: 12, fontWeight: '700' },
  upgradeBadge: { backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  upgradeBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 18 },
  statCardAccent: { borderColor: 'rgba(124,58,237,0.4)', backgroundColor: 'rgba(124,58,237,0.08)' },
  statValue: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -1, marginBottom: 4 },
  statValueAccent: { color: colors.accentLight },
  statLabel: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: colors.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },
  actionCard: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 20, marginBottom: 12 },
  actionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
  actionSub: { fontSize: 13, color: colors.muted },
  scoreCard: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 18, marginBottom: 12 },
  scoreCardLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  scoreCardRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  scoreCardNumber: { fontSize: 52, fontWeight: '800', letterSpacing: -2, lineHeight: 56 },
  scoreCardRight: { flex: 1 },
  scoreCardTitle: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 4, lineHeight: 20 },
  scoreCardLink: { fontSize: 12, color: colors.accentLight, fontWeight: '600' },
  streakCard: { backgroundColor: 'rgba(124,58,237,0.08)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(124,58,237,0.2)', padding: 16, marginBottom: 24 },
  streakText: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 2 },
  streakSub: { fontSize: 12, color: colors.muted },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: 32 },
  errorTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8 },
  errorText: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  retryBtn: { backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 12 },
  retryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
