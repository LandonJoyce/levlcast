import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/colors';

interface CoachReport {
  overall_score: number;
  stream_summary: string;
  energy_trend: 'building' | 'declining' | 'consistent' | 'volatile';
  viewer_retention_risk: 'low' | 'medium' | 'high';
  strengths: string[];
  improvements: string[];
  best_moment: { time: string; description: string };
  content_mix: { category: string; percentage: number }[];
  recommendation: string;
  next_stream_goals: string[];
}

interface Peak {
  title: string;
  start: number;
  end: number;
  score: number;
  category: string;
  reason: string;
  caption: string;
}

interface Vod {
  id: string;
  title: string;
  stream_date: string;
  status: string;
  coach_report: CoachReport | null;
  peak_data: Peak[] | null;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function scoreColor(score: number): string {
  if (score >= 75) return colors.green;
  if (score >= 50) return colors.yellow;
  return colors.red;
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
            <View style={[styles.scoreRing, { borderColor: scoreColor(report.overall_score) }]}>
              <Text style={[styles.scoreNum, { color: scoreColor(report.overall_score) }]}>{report.overall_score}</Text>
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

          {/* Viewer retention risk */}
          {report.viewer_retention_risk && (
            <View style={[styles.retentionCard, {
              borderColor: report.viewer_retention_risk === 'low' ? colors.green + '60' :
                report.viewer_retention_risk === 'medium' ? colors.yellow + '60' : colors.red + '60'
            }]}>
              <Text style={styles.sectionLabel}>Viewer Retention Risk</Text>
              <Text style={[styles.retentionValue, {
                color: report.viewer_retention_risk === 'low' ? colors.green :
                  report.viewer_retention_risk === 'medium' ? colors.yellow : colors.red
              }]}>
                {report.viewer_retention_risk.charAt(0).toUpperCase() + report.viewer_retention_risk.slice(1)}
              </Text>
            </View>
          )}

          {/* Coach's take */}
          <View style={styles.recommendCard}>
            <Text style={styles.sectionLabel}>Coach's Take</Text>
            <Text style={styles.recommendText}>{report.recommendation}</Text>
          </View>

          {/* Next stream goals */}
          {report.next_stream_goals && report.next_stream_goals.length > 0 && (
            <View style={styles.goalsCard}>
              <Text style={styles.sectionLabel}>Next Stream Goals</Text>
              {report.next_stream_goals.map((goal, i) => (
                <View key={i} style={styles.goalRow}>
                  <View style={styles.goalNumber}>
                    <Text style={styles.goalNumberText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.goalText}>{goal}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}

      {/* Peak moments */}
      {peaks.length > 0 && (
        <View style={styles.peaksSection}>
          <Text style={styles.sectionLabel}>Peak Moments ({peaks.length})</Text>
          {peaks.map((p, i) => (
            <View key={i} style={styles.peakRow}>
              <View style={styles.peakHeader}>
                <Text style={styles.peakTitle}>{p.title}</Text>
                <Text style={styles.peakCategory}>{p.category}</Text>
              </View>
              <Text style={styles.peakReason}>{p.reason}</Text>
              <View style={styles.peakMeta}>
                <Text style={styles.peakTime}>
                  {formatTime(p.start)} – {formatTime(p.end)}
                </Text>
                <Text style={styles.peakScore}>Score {Math.round(p.score * 100)}</Text>
              </View>
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

  // Retention risk
  retentionCard: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 14, backgroundColor: colors.surface },
  retentionValue: { fontSize: 18, fontWeight: '800', marginTop: 4 },

  // Coach's take
  recommendCard: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 18, marginBottom: 14 },
  recommendText: { fontSize: 14, color: colors.text, lineHeight: 21, fontStyle: 'italic' },

  // Next stream goals
  goalsCard: { backgroundColor: 'rgba(124,58,237,0.08)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(124,58,237,0.25)', padding: 18, marginBottom: 24 },
  goalRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  goalNumber: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: 'rgba(124,58,237,0.5)', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  goalNumberText: { fontSize: 11, fontWeight: '800', color: colors.accentLight },
  goalText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 19 },

  // Peak moments
  peaksSection: { marginBottom: 8 },
  peakRow: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 8 },
  peakHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 },
  peakTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.text },
  peakCategory: { fontSize: 11, fontWeight: '600', color: colors.accentLight, textTransform: 'capitalize', backgroundColor: 'rgba(124,58,237,0.12)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  peakReason: { fontSize: 12, color: colors.muted, lineHeight: 17, marginBottom: 8 },
  peakMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  peakTime: { fontSize: 12, fontWeight: '600', color: colors.muted },
  peakScore: { fontSize: 12, fontWeight: '700', color: colors.accentLight },

  // Shared
  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 },
});
