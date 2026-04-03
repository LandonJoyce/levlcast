import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/colors';

export default function DashboardScreen() {
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({ vods: 0, analyzed: 0, peaks: 0, clips: 0 });
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [profileRes, vodsRes, clipsRes] = await Promise.all([
      supabase.from('profiles').select('twitch_display_name, twitch_avatar_url, plan').eq('id', user.id).single(),
      supabase.from('vods').select('id, status, peak_data').eq('user_id', user.id),
      supabase.from('clips').select('id').eq('user_id', user.id).eq('status', 'ready'),
    ]);

    setProfile(profileRes.data);

    const vods = vodsRes.data || [];
    const analyzed = vods.filter(v => v.status === 'ready');
    const peaks = analyzed.reduce((sum: number, v: any) => sum + ((v.peak_data as any[])?.length || 0), 0);

    setStats({
      vods: vods.length,
      analyzed: analyzed.length,
      peaks,
      clips: clipsRes.data?.length || 0,
    });
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
});
