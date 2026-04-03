import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/colors';

interface CoachReport {
  overall_score: number;
  stream_summary: string;
  energy_trend: 'building' | 'declining' | 'consistent' | 'volatile';
  strengths: string[];
  improvements: string[];
  best_moment: { time: string; description: string };
  content_mix: { category: string; percentage: number }[];
  recommendation: string;
}

interface Peak {
  timestamp: string;
  reason: string;
  intensity?: number;
}

interface Vod {
  id: string;
  title: string;
  stream_date: string;
  status: string;
  coach_report: CoachReport | null;
  peak_data: Peak[] | null;
}

const TREND_CONFIG = {
  building:   { label: 'Building', color: colors.green,  icon: '↗' },
  declining:  { label: 'Declining', color: colors.red,   icon: '↘' },
  consistent: { label: 'Consistent', color: colors.yellow, icon: '→' },
  volatile:   { label: 'Volatile',   color: colors.muted, icon: '↕' },
};

export default function VodDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [vod, setVod] = useState<Vod | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!id) return;
    supabase
      .from('vods')
      .select('id, title, stream_date, status, coach_report, peak_data')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setVod(data as Vod);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.accentLight} /></View>;
  }

  if (!vod) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>VOD not found.</Text>
      </View>
    );
  }

  const report = vod.coach_report;
  const peaks = vod.peak_data || [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.title} numberOfLines={3}>{vod.title}</Text>
      <Text style={styles.date}>
        {new Date(vod.stream_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
      </Text>

      {!report && (
        <View style={styles.noReport}>
          <Text style={styles.noReportText}>Coach report is still generating. Check back in a moment.</Text>
        </View>
      )}

      {report && (
        <>
          {/* Score ring */}
          <View style={styles.scoreCard}>
            <View style={styles.scoreRing}>
              <Text style={styles.scoreNum}>{report.overall_score}</Text>
              <Text style={styles.scoreOf}>/100</Text>
            </View>
            <View style={styles.scoreRight}>
              <Text style={styles.scoreLabel}>Stream Score</Text>
              <Text style={styles.scoreSummary}>{report.stream_summary}</Text>
            </View>
          </View>

          {/* Energy trend */}
          {(() => {
            const trend = TREND_CONFIG[report.energy_trend] || TREND_CONFIG.consistent;
            return (
              <View style={[styles.trendCard, { borderColor: trend.color + '60' }]}>
                <Text style={[styles.trendIcon, { color: trend.color }]}>{trend.icon}</Text>
                <View>
                  <Text style={styles.trendHeading}>Energy Trend</Text>
                  <Text style={[styles.trendValue, { color: trend.color }]}>{trend.label}</Text>
                </View>
              </View>
            );
          })()}

          {/* Best moment */}
          {report.best_moment && (
            <View style={styles.bestMomentCard}>
              <Text style={styles.sectionLabel}>Best Moment</Text>
              <Text style={styles.bestMomentTime}>{report.best_moment.time}</Text>
              <Text style={styles.bestMomentDesc}>{report.best_moment.description}</Text>
            </View>
          )}

          {/* Strengths & improvements */}
          <View style={styles.columnsRow}>
            <View style={[styles.column, styles.strengthsCol]}>
              <Text style={styles.sectionLabel}>Strengths</Text>
              {report.strengths.map((s, i) => (
                <View key={i} style={styles.bulletRow}>
                  <Text style={[styles.bullet, { color: colors.green }]}>✓</Text>
                  <Text style={styles.bulletText}>{s}</Text>
                </View>
              ))}
            </View>
            <View style={[styles.column, styles.improvementsCol]}>
              <Text style={styles.sectionLabel}>Improve</Text>
              {report.improvements.map((s, i) => (
                <View key={i} style={styles.bulletRow}>
                  <Text style={[styles.bullet, { color: colors.yellow }]}>→</Text>
                  <Text style={styles.bulletText}>{s}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Content mix */}
          {report.content_mix && report.content_mix.length > 0 && (
            <View style={styles.mixSection}>
              <Text style={styles.sectionLabel}>Content Mix</Text>
              <View style={styles.mixTags}>
                {report.content_mix.map((item, i) => (
                  <View key={i} style={styles.mixTag}>
                    <Text style={styles.mixTagText}>{item.category} {item.percentage}%</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Coach's take */}
          <View style={styles.recommendCard}>
            <Text style={styles.sectionLabel}>Coach's Take</Text>
            <Text style={styles.recommendText}>{report.recommendation}</Text>
          </View>
        </>
      )}

      {/* Peak moments */}
      {peaks.length > 0 && (
        <View style={styles.peaksSection}>
          <Text style={styles.sectionLabel}>Peak Moments ({peaks.length})</Text>
          {peaks.map((p, i) => (
            <View key={i} style={styles.peakRow}>
              <Text style={styles.peakTime}>{p.timestamp}</Text>
              <Text style={styles.peakReason}>{p.reason}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 60 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  backBtn: { marginBottom: 16 },
  backText: { color: colors.accentLight, fontSize: 15, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, letterSpacing: -0.5, marginBottom: 6, lineHeight: 26 },
  date: { fontSize: 12, color: colors.muted, marginBottom: 24 },
  errorText: { color: colors.muted, fontSize: 15 },
  noReport: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 20 },
  noReportText: { color: colors.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 },

  // Score card
  scoreCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(124,58,237,0.1)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.3)',
    padding: 20,
    marginBottom: 14,
    alignItems: 'center',
    gap: 18,
  },
  scoreRing: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: colors.accentLight, alignItems: 'center', justifyContent: 'center' },
  scoreNum: { fontSize: 28, fontWeight: '800', color: colors.accentLight, letterSpacing: -1 },
  scoreOf: { fontSize: 12, color: colors.muted, marginTop: -4 },
  scoreRight: { flex: 1 },
  scoreLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  scoreSummary: { fontSize: 13, color: colors.text, lineHeight: 18 },

  // Trend
  trendCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 14 },
  trendIcon: { fontSize: 28, fontWeight: '800' },
  trendHeading: { fontSize: 11, fontWeight: '700', color: colors.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
  trendValue: { fontSize: 16, fontWeight: '800' },

  // Best moment
  bestMomentCard: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 18, marginBottom: 14 },
  bestMomentTime: { fontSize: 22, fontWeight: '800', color: colors.accentLight, marginBottom: 4 },
  bestMomentDesc: { fontSize: 13, color: colors.text, lineHeight: 19 },

  // Strengths / improvements
  columnsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  column: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 16 },
  strengthsCol: { backgroundColor: 'rgba(34,197,94,0.06)', borderColor: 'rgba(34,197,94,0.3)' },
  improvementsCol: { backgroundColor: 'rgba(234,179,8,0.06)', borderColor: 'rgba(234,179,8,0.3)' },
  bulletRow: { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'flex-start' },
  bullet: { fontSize: 13, fontWeight: '700', marginTop: 1 },
  bulletText: { flex: 1, fontSize: 12, color: colors.text, lineHeight: 17 },

  // Content mix
  mixSection: { marginBottom: 14 },
  mixTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  mixTag: { backgroundColor: 'rgba(124,58,237,0.12)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(124,58,237,0.25)' },
  mixTagText: { fontSize: 12, fontWeight: '600', color: colors.accentLight },

  // Coach's take
  recommendCard: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 18, marginBottom: 24 },
  recommendText: { fontSize: 14, color: colors.text, lineHeight: 21, fontStyle: 'italic' },

  // Peak moments
  peaksSection: { marginBottom: 8 },
  peakRow: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 8 },
  peakTime: { fontSize: 13, fontWeight: '700', color: colors.accentLight, marginBottom: 4 },
  peakReason: { fontSize: 13, color: colors.text, lineHeight: 18 },

  // Shared
  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 },
});
