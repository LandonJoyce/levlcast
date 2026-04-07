import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Share } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
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

interface Clip {
  id: string;
  title: string;
  status: string;
  video_url: string | null;
  caption_text: string | null;
  peak_score: number | null;
  start_time_seconds: number | null;
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
  building:   { label: 'Building',    color: colors.green,  icon: '↗' },
  declining:  { label: 'Declining',   color: colors.red,    icon: '↘' },
  consistent: { label: 'Consistent',  color: colors.yellow, icon: '→' },
  volatile:   { label: 'Volatile',    color: colors.muted,  icon: '↕' },
};

// Parses **Bold Label** — rest of text and renders bold label + dimmer text
function BoldLeadText({ text, bulletColor }: { text: string; bulletColor: string }) {
  const match = text.match(/^\*\*(.+?)\*\*\s*[—–-]\s*([\s\S]+)$/);
  if (!match) {
    return <Text style={styles.bulletText}>{text}</Text>;
  }
  return (
    <Text style={styles.bulletText}>
      <Text style={styles.bulletBold}>{match[1]}</Text>
      <Text style={{ color: colors.muted }}> — </Text>
      {match[2]}
    </Text>
  );
}

export default function VodDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [vod, setVod] = useState<Vod | null>(null);
  const [previousScore, setPreviousScore] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!id) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [vodRes, prevRes, streakRes, clipsRes] = await Promise.all([
      supabase.from('vods')
        .select('id, title, stream_date, status, coach_report, peak_data')
        .eq('id', id).single(),
      supabase.from('vods')
        .select('coach_report')
        .eq('user_id', user.id).eq('status', 'ready').neq('id', id)
        .order('stream_date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('vods')
        .select('status').eq('user_id', user.id)
        .order('stream_date', { ascending: false }).limit(20),
      supabase.from('clips')
        .select('id, title, status, video_url, caption_text, peak_score, start_time_seconds')
        .eq('vod_id', id).eq('user_id', user.id)
        .order('created_at', { ascending: false }),
    ]);

    setVod(vodRes.data as Vod);

    const prevScore = (prevRes.data?.coach_report as any)?.overall_score;
    setPreviousScore(typeof prevScore === 'number' ? prevScore : null);

    const streakVods = streakRes.data || [];
    let count = 0;
    for (const v of streakVods) {
      if (v.status === 'ready') count++;
      else break;
    }
    setStreak(count);

    setClips((clipsRes.data || []) as Clip[]);
    setLoading(false);
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-poll when still processing
  useEffect(() => {
    if (!vod) return;
    if (vod.status !== 'transcribing' && vod.status !== 'analyzing') return;
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, [vod?.status, loadData]);

  async function shareClip(clip: Clip) {
    const parts: string[] = [clip.title];
    if (clip.caption_text) parts.push('\n' + clip.caption_text);
    if (clip.video_url) parts.push('\n' + clip.video_url);
    await Share.share({ message: parts.join('') });
  }

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
  const isProcessing = vod.status === 'transcribing' || vod.status === 'analyzing';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <Text style={styles.title} numberOfLines={3}>{vod.title}</Text>
      <Text style={styles.date}>
        {new Date(vod.stream_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
      </Text>

      {/* Processing state */}
      {isProcessing && (
        <View style={styles.processingCard}>
          <ActivityIndicator color={colors.accentLight} style={{ marginBottom: 12 }} />
          <Text style={styles.processingTitle}>
            {vod.status === 'transcribing' ? 'Transcribing stream...' : 'Generating coaching report...'}
          </Text>
          <Text style={styles.processingText}>This usually takes 2–5 minutes. The page updates automatically.</Text>
        </View>
      )}

      {report && (
        <>
          {/* Score Hero */}
          <View style={styles.scoreHero}>
            <View style={[styles.scoreRing, { borderColor: scoreColor(report.overall_score) }]}>
              <Text style={[styles.scoreNum, { color: scoreColor(report.overall_score) }]}>{report.overall_score}</Text>
              <Text style={styles.scoreOf}>/100</Text>
            </View>
            <View style={styles.scoreRight}>
              {/* Delta badge */}
              {previousScore !== null && (() => {
                const delta = report.overall_score - previousScore;
                if (delta === 0) return (
                  <View style={[styles.deltaBadge, styles.deltaNeutral]}>
                    <Text style={[styles.deltaText, { color: colors.muted }]}>Same as last stream</Text>
                  </View>
                );
                return (
                  <View style={[styles.deltaBadge, delta > 0 ? styles.deltaUp : styles.deltaDown]}>
                    <Text style={[styles.deltaText, { color: delta > 0 ? colors.green : colors.red }]}>
                      {delta > 0 ? `+${delta}` : delta} from last stream
                    </Text>
                  </View>
                );
              })()}
              {/* Streak badge */}
              {streak >= 2 && (
                <View style={styles.streakBadge}>
                  <Text style={styles.streakText}>🔥 {streak} stream streak</Text>
                </View>
              )}
              {/* Stat pills */}
              <View style={styles.pillRow}>
                {(() => {
                  const trend = TREND_CONFIG[report.energy_trend] || TREND_CONFIG.consistent;
                  return (
                    <View style={[styles.pill, { borderColor: trend.color + '50', backgroundColor: trend.color + '18' }]}>
                      <Text style={[styles.pillText, { color: trend.color }]}>{trend.icon} {trend.label}</Text>
                    </View>
                  );
                })()}
                {report.viewer_retention_risk && (
                  <View style={[styles.pill, {
                    borderColor: (report.viewer_retention_risk === 'low' ? colors.green : report.viewer_retention_risk === 'medium' ? colors.yellow : colors.red) + '50',
                    backgroundColor: (report.viewer_retention_risk === 'low' ? colors.green : report.viewer_retention_risk === 'medium' ? colors.yellow : colors.red) + '18',
                  }]}>
                    <Text style={[styles.pillText, {
                      color: report.viewer_retention_risk === 'low' ? colors.green : report.viewer_retention_risk === 'medium' ? colors.yellow : colors.red,
                    }]}>
                      {report.viewer_retention_risk.charAt(0).toUpperCase() + report.viewer_retention_risk.slice(1)} retention risk
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* #1 Priority */}
          <View style={styles.priorityCard}>
            <Text style={styles.priorityLabel}>#1 PRIORITY</Text>
            <Text style={styles.priorityText}>{report.recommendation}</Text>
          </View>

          {/* Clips */}
          {clips.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>GENERATED CLIPS</Text>
              {clips.map(clip => (
                <View key={clip.id} style={styles.clipRow}>
                  <View style={styles.clipInfo}>
                    <Text style={styles.clipTitle} numberOfLines={2}>{clip.title}</Text>
                    {clip.status === 'processing' && (
                      <View style={styles.clipStatusRow}>
                        <ActivityIndicator size="small" color={colors.muted} />
                        <Text style={styles.clipStatusText}>Generating...</Text>
                      </View>
                    )}
                    {clip.status === 'failed' && (
                      <Text style={styles.clipFailed}>Failed</Text>
                    )}
                  </View>
                  {clip.status === 'ready' && clip.video_url && (
                    <TouchableOpacity style={styles.shareBtn} onPress={() => shareClip(clip)}>
                      <Text style={styles.shareBtnText}>Share</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* What Worked / Fix for Next Stream */}
          <View style={styles.section}>
            <View style={styles.workedCard}>
              <Text style={styles.sectionLabel}>WHAT WORKED</Text>
              {(report.strengths ?? []).map((s, i) => (
                <View key={i} style={styles.bulletRow}>
                  <Text style={[styles.bullet, { color: colors.green }]}>✓</Text>
                  <BoldLeadText text={s} bulletColor={colors.green} />
                </View>
              ))}
            </View>
            <View style={styles.fixCard}>
              <Text style={styles.sectionLabel}>FIX FOR NEXT STREAM</Text>
              {(report.improvements ?? []).map((s, i) => (
                <View key={i} style={styles.bulletRow}>
                  <Text style={[styles.bullet, { color: colors.yellow }]}>→</Text>
                  <BoldLeadText text={s} bulletColor={colors.yellow} />
                </View>
              ))}
            </View>
          </View>

          {/* Your Missions */}
          {(report.next_stream_goals ?? []).length > 0 && (
            <View style={styles.missionsCard}>
              <Text style={styles.sectionLabel}>YOUR MISSIONS</Text>
              {(report.next_stream_goals ?? []).map((goal, i) => (
                <View key={i} style={styles.goalRow}>
                  <View style={styles.goalNumber}>
                    <Text style={styles.goalNumberText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.goalText}>{goal}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Best Moment */}
          {report.best_moment && (
            <View style={styles.bestMomentCard}>
              <Text style={styles.sectionLabel}>BEST MOMENT</Text>
              <Text style={styles.bestMomentTime}>{report.best_moment.time}</Text>
              <Text style={styles.bestMomentDesc}>{report.best_moment.description}</Text>
            </View>
          )}

          {/* Stream Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.sectionLabel}>STREAM SUMMARY</Text>
            <Text style={styles.summaryText}>{report.stream_summary}</Text>
          </View>

          {/* Content Mix */}
          {report.content_mix && report.content_mix.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>CONTENT MIX</Text>
              <View style={styles.mixTags}>
                {report.content_mix.map((item, i) => (
                  <View key={i} style={styles.mixTag}>
                    <Text style={styles.mixTagText}>{item.category} {item.percentage}%</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </>
      )}

      {/* Peak Moments */}
      {peaks.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PEAK MOMENTS ({peaks.length})</Text>
          {peaks.map((p, i) => (
            <View key={i} style={styles.peakRow}>
              <View style={styles.peakHeader}>
                <Text style={styles.peakTitle}>{p.title}</Text>
                <Text style={styles.peakCategory}>{p.category}</Text>
              </View>
              <Text style={styles.peakReason}>{p.reason}</Text>
              <View style={styles.peakMeta}>
                <Text style={styles.peakTime}>{formatTime(p.start)} – {formatTime(p.end)}</Text>
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
  title: { fontSize: 20, fontWeight: '800', color: colors.text, letterSpacing: -0.5, marginBottom: 6, lineHeight: 26 },
  date: { fontSize: 12, color: colors.muted, marginBottom: 20 },
  errorText: { color: colors.muted, fontSize: 15 },

  // Processing
  processingCard: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 28, alignItems: 'center', marginBottom: 20 },
  processingTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 8 },
  processingText: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19 },

  // Score hero
  scoreHero: {
    flexDirection: 'row',
    backgroundColor: 'rgba(124,58,237,0.1)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.3)',
    padding: 20,
    marginBottom: 14,
    alignItems: 'flex-start',
    gap: 18,
  },
  scoreRing: { width: 88, height: 88, borderRadius: 44, borderWidth: 3, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  scoreNum: { fontSize: 32, fontWeight: '800', letterSpacing: -1 },
  scoreOf: { fontSize: 12, color: colors.muted, marginTop: -4 },
  scoreRight: { flex: 1, gap: 8 },
  deltaBadge: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  deltaUp: { backgroundColor: 'rgba(74,222,128,0.12)', borderColor: 'rgba(74,222,128,0.3)' },
  deltaDown: { backgroundColor: 'rgba(248,113,113,0.12)', borderColor: 'rgba(248,113,113,0.3)' },
  deltaNeutral: { backgroundColor: 'rgba(136,146,164,0.12)', borderColor: 'rgba(136,146,164,0.3)' },
  deltaText: { fontSize: 12, fontWeight: '700' },
  streakBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(251,191,36,0.15)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(251,191,36,0.35)' },
  streakText: { fontSize: 12, fontWeight: '700', color: colors.yellow },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  pillText: { fontSize: 11, fontWeight: '700' },

  // #1 Priority
  priorityCard: { backgroundColor: 'rgba(124,58,237,0.1)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(124,58,237,0.35)', padding: 18, marginBottom: 14 },
  priorityLabel: { fontSize: 11, fontWeight: '700', color: colors.accentLight, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 },
  priorityText: { fontSize: 14, color: colors.text, lineHeight: 22, fontWeight: '500' },

  // Shared section
  section: { marginBottom: 14 },

  // Clips
  clipRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 8, gap: 12 },
  clipInfo: { flex: 1 },
  clipTitle: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 4 },
  clipStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  clipStatusText: { fontSize: 12, color: colors.muted },
  clipFailed: { fontSize: 12, fontWeight: '600', color: colors.red },
  shareBtn: { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, flexShrink: 0 },
  shareBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // What Worked / Fix for Next Stream
  workedCard: { backgroundColor: 'rgba(74,222,128,0.06)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(74,222,128,0.25)', padding: 16, marginBottom: 10 },
  fixCard: { backgroundColor: 'rgba(251,191,36,0.06)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(251,191,36,0.25)', padding: 16 },
  bulletRow: { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'flex-start' },
  bullet: { fontSize: 13, fontWeight: '700', marginTop: 1 },
  bulletText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 19 },
  bulletBold: { fontWeight: '800', color: '#fff' },

  // Your Missions
  missionsCard: { backgroundColor: 'rgba(124,58,237,0.08)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(124,58,237,0.25)', padding: 18, marginBottom: 14 },
  goalRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  goalNumber: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: 'rgba(124,58,237,0.5)', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  goalNumberText: { fontSize: 11, fontWeight: '800', color: colors.accentLight },
  goalText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 19 },

  // Best moment
  bestMomentCard: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 18, marginBottom: 14 },
  bestMomentTime: { fontSize: 22, fontWeight: '800', color: colors.accentLight, marginBottom: 4 },
  bestMomentDesc: { fontSize: 13, color: colors.text, lineHeight: 19 },

  // Summary
  summaryCard: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 18, marginBottom: 14 },
  summaryText: { fontSize: 13, color: colors.text, lineHeight: 20 },

  // Content mix
  mixTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  mixTag: { backgroundColor: 'rgba(124,58,237,0.12)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(124,58,237,0.25)' },
  mixTagText: { fontSize: 12, fontWeight: '600', color: colors.accentLight },

  // Peak moments
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
