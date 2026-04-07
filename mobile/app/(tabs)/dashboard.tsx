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
  const [burnout, setBurnout] = useState<any>(null);
  const [burnoutExpanded, setBurnoutExpanded] = useState(false);
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

    // Fetch burnout data (non-blocking)
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const res = await fetch(`${process.env.EXPO_PUBLIC_APP_URL}/api/burnout`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) setBurnout(await res.json());
      }
    } catch {} // non-fatal

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

      {/* Streamer Health */}
      {burnout?.latest && <BurnoutHealthCard data={burnout} expanded={burnoutExpanded} onToggle={() => setBurnoutExpanded(!burnoutExpanded)} />}

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

function burnoutColor(score: number) {
  if (score <= 25) return { bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.25)', text: colors.green, label: 'Healthy' };
  if (score <= 45) return { bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.25)', text: colors.yellow, label: 'Watch' };
  if (score <= 65) return { bg: 'rgba(251,146,60,0.08)', border: 'rgba(251,146,60,0.25)', text: '#fb923c', label: 'Warning' };
  return { bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.25)', text: colors.red, label: 'Alert' };
}

function BurnoutHealthCard({ data, expanded, onToggle }: { data: any; expanded: boolean; onToggle: () => void }) {
  const latest = data.latest;
  const history: any[] = data.history || [];
  const bc = burnoutColor(latest.score);
  const healthPct = 100 - latest.score;

  return (
    <TouchableOpacity
      style={[styles.burnoutCard, { backgroundColor: bc.bg, borderColor: bc.border }]}
      onPress={onToggle}
      activeOpacity={0.8}
    >
      <View style={styles.burnoutHeader}>
        <Text style={styles.burnoutLabel}>STREAMER HEALTH</Text>
        <Text style={[styles.burnoutStatus, { color: bc.text }]}>{bc.label}</Text>
      </View>
      <View style={styles.burnoutBarBg}>
        <View style={[styles.burnoutBarFill, { width: `${healthPct}%`, backgroundColor: bc.text }]} />
      </View>
      {latest.insight && <Text style={styles.burnoutInsight}>{latest.insight}</Text>}
      {expanded && latest.recommendation && (
        <View style={styles.burnoutExpanded}>
          <Text style={styles.burnoutRec}>
            <Text style={styles.burnoutRecBold}>This week: </Text>
            {latest.recommendation}
          </Text>
          {history.length > 1 && (
            <View style={styles.burnoutSparkline}>
              {history.map((snap: any, i: number) => (
                <View
                  key={snap.computed_at}
                  style={[
                    styles.burnoutBar,
                    { height: Math.max(4, (100 - snap.score) * 0.3), backgroundColor: i === history.length - 1 ? bc.text : 'rgba(255,255,255,0.1)' },
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
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
  burnoutCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 24 },
  burnoutHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  burnoutLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, letterSpacing: 1 },
  burnoutStatus: { fontSize: 13, fontWeight: '700' },
  burnoutBarBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden', marginBottom: 10 },
  burnoutBarFill: { height: '100%', borderRadius: 3 },
  burnoutInsight: { fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 19 },
  burnoutExpanded: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  burnoutRec: { fontSize: 13, color: colors.muted, lineHeight: 19, marginBottom: 10 },
  burnoutRecBold: { fontWeight: '700', color: 'rgba(255,255,255,0.9)' },
  burnoutSparkline: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 24 },
  burnoutBar: { flex: 1, borderRadius: 2, minHeight: 4 },
});
