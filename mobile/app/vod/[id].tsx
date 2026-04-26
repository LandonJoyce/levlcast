import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Share, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/colors';

interface CoachReport {
  overall_score: number;
  streamer_type: 'gaming' | 'just_chatting' | 'irl' | 'variety' | 'educational';
  energy_trend: 'building' | 'declining' | 'consistent' | 'volatile';
  viewer_retention_risk: 'low' | 'medium' | 'high';
  strengths: string[];
  improvements: string[];
  best_moment: { time: string; description: string };
  recommendation: string;
  next_stream_goals: string[];
  cold_open?: { score: 'strong' | 'weak' | 'average'; note: string };
  dead_zones?: Array<{ time: string; duration: number }>;
  momentum_crash?: { time: string; duration_min: number; note: string };
  trend_vs_history?: { direction: 'improving' | 'declining' | 'consistent' | 'first_stream'; note: string };
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
  failed_reason: string | null;
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

const CATEGORY_LABELS: Record<string, string> = {
  hype: 'Hype',
  funny: 'Comedy',
  educational: 'Educational',
  emotional: 'Emotional',
  clutch_play: 'Clutch Plays',
  rage: 'Rage',
  wholesome: 'Wholesome',
};

const CATEGORY_COLORS: Record<string, string> = {
  hype: '#f59e0b',
  funny: '#a78bfa',
  educational: '#3b82f6',
  emotional: '#f472b6',
  clutch_play: '#22d3ee',
  rage: '#ef4444',
  wholesome: '#4ade80',
};

const COLD_OPEN_CONFIG = {
  strong:  { label: 'Strong Open', color: colors.green },
  average: { label: 'Average Open', color: colors.yellow },
  weak:    { label: 'Weak Open', color: colors.red },
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

function LockedCard({ label, onUpgrade }: { label: string; onUpgrade: () => void }) {
  return (
    <TouchableOpacity
      onPress={onUpgrade}
      style={{ backgroundColor: 'rgba(124,58,237,0.07)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(124,58,237,0.2)', padding: 18, marginBottom: 14, alignItems: 'center', gap: 6 }}
      activeOpacity={0.8}
    >
      <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(124,58,237,0.7)', letterSpacing: 1, textTransform: 'uppercase' }}>{label}</Text>
      <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>Unlock with Pro →</Text>
    </TouchableOpacity>
  );
}

export default function VodDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [vod, setVod] = useState<Vod | null>(null);
  const [previousScore, setPreviousScore] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const [clips, setClips] = useState<Clip[]>([]);
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [generatingPeak, setGeneratingPeak] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
    setLoadError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace('/login'); return; }

    const [vodRes, prevRes, streakRes, clipsRes, profileRes] = await Promise.all([
      supabase.from('vods')
        .select('id, title, stream_date, status, coach_report, peak_data, failed_reason')
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
      supabase.from('profiles').select('plan, subscription_expires_at').eq('id', user.id).single(),
    ]);

    setVod(vodRes.data as Vod);

    const profile = profileRes.data;
    const proActive = profile?.plan === 'pro' &&
      !(profile.subscription_expires_at && new Date(profile.subscription_expires_at) < new Date());
    setIsPro(proActive);

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
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load stream report');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-poll when VOD is processing OR any clip is generating
  useEffect(() => {
    if (!vod) return;
    const vodProcessing = vod.status === 'transcribing' || vod.status === 'analyzing';
    const clipProcessing = clips.some(c => c.status === 'processing');
    if (!vodProcessing && !clipProcessing) return;
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, [vod?.status, clips, loadData]);

  async function retryAnalysis() {
    if (!id) return;
    setRetrying(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${process.env.EXPO_PUBLIC_APP_URL}/api/vods/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ vodId: id }),
      });
      const json = await res.json();
      if (json.upgrade) {
        router.push('/subscribe');
      } else {
        await loadData();
      }
    } catch {
      Alert.alert('Retry failed', 'Could not start analysis. Try again.');
    } finally {
      setRetrying(false);
    }
  }

  async function generateClip(peakIndex: number) {
    if (!id || generatingPeak !== null) return;
    setGeneratingPeak(peakIndex);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${process.env.EXPO_PUBLIC_APP_URL}/api/clips/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ vodId: id, peakIndex }),
      });
      const json = await res.json();
      if (json.upgrade) {
        router.push('/subscribe');
      } else if (json.error) {
        Alert.alert('Clip generation', json.message || json.error);
      } else {
        await loadData();
      }
    } catch {
      Alert.alert('Clip failed', 'Could not generate clip. Try again.');
    } finally {
      setGeneratingPeak(null);
    }
  }

  async function shareClip(clip: Clip) {
    const parts: string[] = [clip.title];
    if (clip.caption_text) parts.push('\n' + clip.caption_text);
    if (clip.video_url) parts.push('\n' + clip.video_url);
    await Share.share({ message: parts.join('') });
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.accentLight} /></View>;
  }

  if (loadError) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadErrorTitle}>Couldn't load report</Text>
        <Text style={styles.loadErrorText}>{loadError}</Text>
        <TouchableOpacity style={styles.loadErrorBtn} onPress={loadData}>
          <Text style={styles.loadErrorBtnText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
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
  const hasProcessingClip = clips.some(c => c.status === 'processing');

  // Track which peak start times already have a clip (ready or processing)
  const claimedStarts = new Set(
    clips
      .filter(c => c.status === 'ready' || c.status === 'processing')
      .map(c => c.start_time_seconds)
  );

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

      {/* Failed state */}
      {vod.status === 'failed' && (
        <View style={styles.failedCard}>
          <Text style={styles.failedTitle}>Analysis failed</Text>
          <Text style={styles.failedText}>
            {vod.failed_reason || 'Something went wrong during analysis. You can retry below.'}
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={retryAnalysis} disabled={retrying}>
            {retrying
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.retryBtnText}>Retry Analysis</Text>
            }
          </TouchableOpacity>
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

          {/* #1 Priority — GATED */}
          {isPro ? (
            <View style={styles.priorityCard}>
              <Text style={styles.priorityLabel}>#1 PRIORITY</Text>
              <Text style={styles.priorityText}>{report.recommendation}</Text>
            </View>
          ) : (
            <LockedCard label="#1 Priority Fix" onUpgrade={() => router.push('/subscribe')} />
          )}

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

          {/* What Worked — 1 strength free, rest locked */}
          <View style={styles.section}>
            <View style={styles.workedCard}>
              <Text style={styles.sectionLabel}>WHAT WORKED</Text>
              {(isPro ? (report.strengths ?? []) : (report.strengths ?? []).slice(0, 1)).map((s, i) => (
                <View key={i} style={styles.bulletRow}>
                  <Text style={[styles.bullet, { color: colors.green }]}>✓</Text>
                  <BoldLeadText text={s} bulletColor={colors.green} />
                </View>
              ))}
              {!isPro && (report.strengths ?? []).length > 1 && (
                <TouchableOpacity onPress={() => router.push('/subscribe')} style={{ marginTop: 4 }}>
                  <Text style={{ fontSize: 12, color: 'rgba(124,58,237,0.7)', fontWeight: '600' }}>+{(report.strengths ?? []).length - 1} more — Unlock with Pro →</Text>
                </TouchableOpacity>
              )}
            </View>
            {/* Fix for Next Stream — GATED */}
            {isPro ? (
              <View style={styles.fixCard}>
                <Text style={styles.sectionLabel}>FIX FOR NEXT STREAM</Text>
                {(report.improvements ?? []).map((s, i) => (
                  <View key={i} style={styles.bulletRow}>
                    <Text style={[styles.bullet, { color: colors.yellow }]}>→</Text>
                    <BoldLeadText text={s} bulletColor={colors.yellow} />
                  </View>
                ))}
              </View>
            ) : (
              <LockedCard label="Fix For Next Stream" onUpgrade={() => router.push('/subscribe')} />
            )}
          </View>

          {/* Your Missions — GATED */}
          {isPro ? (
            (report.next_stream_goals ?? []).length > 0 && (
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
            )
          ) : (
            <LockedCard label="Your Missions · 3 next-stream goals" onUpgrade={() => router.push('/subscribe')} />
          )}

          {/* Best Moment — GATED */}
          {isPro ? (
            report.best_moment && (
              <View style={styles.bestMomentCard}>
                <Text style={styles.sectionLabel}>BEST MOMENT</Text>
                <Text style={styles.bestMomentTime}>{report.best_moment.time}</Text>
                <Text style={styles.bestMomentDesc}>{report.best_moment.description}</Text>
              </View>
            )
          ) : (
            <LockedCard label="Best Moment" onUpgrade={() => router.push('/subscribe')} />
          )}

          {/* Cold Open */}
          {report.cold_open && (
            <View style={styles.insightCard}>
              <View style={styles.insightHeader}>
                <Text style={styles.sectionLabel}>COLD OPEN</Text>
                <View style={[styles.insightBadge, {
                  backgroundColor: COLD_OPEN_CONFIG[report.cold_open.score]?.color + '18' || colors.muted + '18',
                  borderColor: COLD_OPEN_CONFIG[report.cold_open.score]?.color + '50' || colors.muted + '50',
                }]}>
                  <Text style={[styles.insightBadgeText, {
                    color: COLD_OPEN_CONFIG[report.cold_open.score]?.color || colors.muted,
                  }]}>{COLD_OPEN_CONFIG[report.cold_open.score]?.label || report.cold_open.score}</Text>
                </View>
              </View>
              <Text style={styles.insightText}>{report.cold_open.note}</Text>
            </View>
          )}

          {/* Momentum Crash */}
          {report.momentum_crash && (
            <View style={styles.insightCard}>
              <Text style={styles.sectionLabel}>WORST ENERGY DROP</Text>
              <Text style={styles.insightTime}>{report.momentum_crash.time} ({report.momentum_crash.duration_min} min)</Text>
              <Text style={styles.insightText}>{report.momentum_crash.note}</Text>
            </View>
          )}

          {/* Dead Zones */}
          {report.dead_zones && report.dead_zones.length > 0 && (
            <View style={styles.insightCard}>
              <Text style={styles.sectionLabel}>DEAD ZONES</Text>
              {report.dead_zones.map((dz, i) => (
                <View key={i} style={styles.deadZoneRow}>
                  <Text style={styles.deadZoneTime}>{dz.time}</Text>
                  <Text style={styles.deadZoneDur}>{Math.round(dz.duration / 60)} min</Text>
                </View>
              ))}
            </View>
          )}

          {/* Trend vs History */}
          {report.trend_vs_history && report.trend_vs_history.direction !== 'first_stream' && (
            <View style={styles.insightCard}>
              <View style={styles.insightHeader}>
                <Text style={styles.sectionLabel}>TREND</Text>
                <View style={[styles.insightBadge, {
                  backgroundColor: (report.trend_vs_history.direction === 'improving' ? colors.green : report.trend_vs_history.direction === 'declining' ? colors.red : colors.yellow) + '18',
                  borderColor: (report.trend_vs_history.direction === 'improving' ? colors.green : report.trend_vs_history.direction === 'declining' ? colors.red : colors.yellow) + '50',
                }]}>
                  <Text style={[styles.insightBadgeText, {
                    color: report.trend_vs_history.direction === 'improving' ? colors.green : report.trend_vs_history.direction === 'declining' ? colors.red : colors.yellow,
                  }]}>{report.trend_vs_history.direction === 'improving' ? 'Improving' : report.trend_vs_history.direction === 'declining' ? 'Declining' : 'Consistent'}</Text>
                </View>
              </View>
              <Text style={styles.insightText}>{report.trend_vs_history.note}</Text>
            </View>
          )}
        </>
      )}

      {/* Peak Moments */}
      {peaks.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PEAK MOMENTS ({peaks.length})</Text>
          {peaks.map((p, i) => {
            const alreadyClaimed = claimedStarts.has(Math.round(p.start));
            return (
              <View key={i} style={styles.peakRow}>
                <View style={styles.peakHeader}>
                  <Text style={styles.peakTitle}>{p.title}</Text>
                  <View style={[styles.peakCategoryPill, {
                    backgroundColor: (CATEGORY_COLORS[p.category] || colors.accentLight) + '18',
                    borderColor: (CATEGORY_COLORS[p.category] || colors.accentLight) + '50',
                  }]}>
                    <Text style={[styles.peakCategoryText, {
                      color: CATEGORY_COLORS[p.category] || colors.accentLight,
                    }]}>{CATEGORY_LABELS[p.category] || p.category}</Text>
                  </View>
                </View>
                <Text style={styles.peakReason}>{p.reason}</Text>
                <View style={styles.peakMeta}>
                  <View style={styles.peakMetaLeft}>
                    <Text style={styles.peakTime}>{formatTime(p.start)} – {formatTime(p.end)}</Text>
                    <Text style={styles.peakScore}>Score {Math.round(p.score * 100)}</Text>
                  </View>
                  {alreadyClaimed ? (
                    <Text style={styles.clipGenerated}>Clip generated</Text>
                  ) : (
                    <TouchableOpacity
                      style={[styles.genClipBtn, (hasProcessingClip || generatingPeak !== null) && styles.genClipBtnDisabled]}
                      onPress={() => generateClip(i)}
                      disabled={hasProcessingClip || generatingPeak !== null}
                    >
                      {generatingPeak === i ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.genClipBtnText}>Generate Clip</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
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
  loadErrorTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8 },
  loadErrorText: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  loadErrorBtn: { backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 12 },
  loadErrorBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Processing
  processingCard: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 28, alignItems: 'center', marginBottom: 20 },
  processingTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 8 },
  processingText: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19 },
  failedCard: { backgroundColor: 'rgba(248,113,113,0.08)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(248,113,113,0.25)', padding: 24, alignItems: 'center', marginBottom: 20 },
  failedTitle: { fontSize: 17, fontWeight: '700', color: colors.red, marginBottom: 8 },
  failedText: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19, marginBottom: 16 },
  retryBtn: { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  retryBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

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

  // Insight cards (cold open, momentum crash, dead zones, trend)
  insightCard: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 18, marginBottom: 14 },
  insightHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  insightBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1 },
  insightBadgeText: { fontSize: 11, fontWeight: '700' },
  insightTime: { fontSize: 16, fontWeight: '800', color: colors.accentLight, marginBottom: 4 },
  insightText: { fontSize: 13, color: colors.text, lineHeight: 20 },
  deadZoneRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  deadZoneTime: { fontSize: 13, fontWeight: '600', color: colors.text },
  deadZoneDur: { fontSize: 12, fontWeight: '600', color: colors.muted },

  // Peak moments
  peakRow: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 8 },
  peakHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 },
  peakTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.text },
  peakCategoryPill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1 },
  peakCategoryText: { fontSize: 11, fontWeight: '700' },
  peakReason: { fontSize: 12, color: colors.muted, lineHeight: 17, marginBottom: 8 },
  peakMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  peakMetaLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  peakTime: { fontSize: 12, fontWeight: '600', color: colors.muted },
  peakScore: { fontSize: 12, fontWeight: '700', color: colors.accentLight },
  clipGenerated: { fontSize: 12, fontWeight: '600', color: colors.green },
  genClipBtn: { backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  genClipBtnDisabled: { opacity: 0.4 },
  genClipBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Shared
  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 },
});
