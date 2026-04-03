import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/colors';

interface Snapshot {
  snapshot_date: string;
  follower_count: number;
}

interface VodScore {
  title: string;
  stream_date: string;
  score: number;
}

export default function AnalyticsScreen() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [vodScores, setVodScores] = useState<VodScore[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [snapshotRes, vodsRes] = await Promise.all([
      supabase
        .from('follower_snapshots')
        .select('snapshot_date, follower_count')
        .eq('user_id', user.id)
        .order('snapshot_date', { ascending: true })
        .limit(30),
      supabase
        .from('vods')
        .select('title, stream_date, coach_report')
        .eq('user_id', user.id)
        .eq('status', 'ready')
        .order('stream_date', { ascending: false })
        .limit(10),
    ]);

    setSnapshots(snapshotRes.data || []);
    setVodScores(
      (vodsRes.data || [])
        .filter((v: any) => v.coach_report?.overall_score != null)
        .map((v: any) => ({
          title: v.title,
          stream_date: v.stream_date,
          score: v.coach_report.overall_score,
        }))
    );
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.accentLight} /></View>;
  }

  const latestFollowers = snapshots.length > 0 ? snapshots[snapshots.length - 1].follower_count : null;
  const weekAgo = snapshots.length > 7 ? snapshots[snapshots.length - 8].follower_count : snapshots[0]?.follower_count;
  const weekGain = latestFollowers != null && weekAgo != null ? latestFollowers - weekAgo : null;

  const avgScore = vodScores.length > 0
    ? Math.round(vodScores.reduce((s, v) => s + v.score, 0) / vodScores.length)
    : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Growth Analytics</Text>
      <Text style={styles.sub}>Follower trends and stream quality over time.</Text>

      {/* Follower stat cards */}
      <View style={styles.statRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{latestFollowers?.toLocaleString() ?? '—'}</Text>
          <Text style={styles.statLabel}>Total Followers</Text>
        </View>
        <View style={[styles.statCard, weekGain != null && weekGain > 0 && styles.statCardGreen]}>
          <Text style={[styles.statValue, weekGain != null && weekGain > 0 && styles.statValueGreen]}>
            {weekGain != null ? (weekGain >= 0 ? `+${weekGain}` : `${weekGain}`) : '—'}
          </Text>
          <Text style={styles.statLabel}>This Week</Text>
        </View>
      </View>

      {/* Follower sparkline */}
      {snapshots.length > 1 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Follower Trend (30 days)</Text>
          <View style={styles.chartCard}>
            <SparkLine data={snapshots.map(s => s.follower_count)} />
          </View>
        </View>
      )}

      {snapshots.length === 0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            Follower trend data will appear after your first daily snapshot.
            {'\n\n'}Visit the dashboard daily to build your history.
          </Text>
        </View>
      )}

      {/* Stream quality */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Stream Quality</Text>
        {vodScores.length > 0 ? (
          <>
            <View style={styles.avgScoreCard}>
              <Text style={styles.avgScoreValue}>{avgScore}/100</Text>
              <Text style={styles.avgScoreLabel}>Average Coach Score</Text>
            </View>
            {vodScores.map((v, i) => (
              <View key={i} style={styles.scoreRow}>
                <View style={styles.scoreInfo}>
                  <Text style={styles.scoreTitle} numberOfLines={1}>{v.title}</Text>
                  <Text style={styles.scoreDate}>
                    {new Date(v.stream_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
                <ScoreBar score={v.score} />
              </View>
            ))}
          </>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Analyze a VOD to see your stream quality scores here.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function SparkLine({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const W = 300;
  const H = 60;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / range) * H;
    return `${x},${y}`;
  }).join(' ');

  // Use View-based bar chart since SVG may not be available
  return (
    <View style={sparkStyles.container}>
      {data.map((v, i) => {
        const pct = range > 0 ? ((v - min) / range) * 100 : 50;
        return (
          <View key={i} style={sparkStyles.barWrap}>
            <View style={[sparkStyles.bar, { height: `${Math.max(pct, 4)}%` }]} />
          </View>
        );
      })}
    </View>
  );
}

const sparkStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'flex-end', height: 60, gap: 2 },
  barWrap: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { backgroundColor: colors.accentLight, borderRadius: 2, opacity: 0.8 },
});

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? colors.green : score >= 50 ? colors.yellow : colors.red;
  return (
    <View style={scoreBarStyles.wrap}>
      <View style={scoreBarStyles.track}>
        <View style={[scoreBarStyles.fill, { width: `${score}%`, backgroundColor: color }]} />
      </View>
      <Text style={[scoreBarStyles.label, { color }]}>{score}</Text>
    </View>
  );
}

const scoreBarStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  track: { flex: 1, height: 6, backgroundColor: colors.surface2, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  label: { fontSize: 13, fontWeight: '700', width: 26, textAlign: 'right' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 60 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.5, marginBottom: 4 },
  sub: { fontSize: 13, color: colors.muted, marginBottom: 24 },
  statRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 18 },
  statCardGreen: { borderColor: 'rgba(34,197,94,0.4)', backgroundColor: 'rgba(34,197,94,0.06)' },
  statValue: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -1, marginBottom: 4 },
  statValueGreen: { color: colors.green },
  statLabel: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  section: { marginBottom: 28 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 },
  chartCard: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16 },
  emptyCard: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 20 },
  emptyText: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  avgScoreCard: { backgroundColor: 'rgba(124,58,237,0.08)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(124,58,237,0.25)', padding: 18, marginBottom: 14, alignItems: 'center' },
  avgScoreValue: { fontSize: 36, fontWeight: '800', color: colors.accentLight, letterSpacing: -1 },
  avgScoreLabel: { fontSize: 12, color: colors.muted, fontWeight: '600', marginTop: 4 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  scoreInfo: { width: 120 },
  scoreTitle: { fontSize: 13, fontWeight: '600', color: colors.text },
  scoreDate: { fontSize: 11, color: colors.muted, marginTop: 2 },
});
