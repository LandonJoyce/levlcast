import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Image, Linking } from 'react-native';
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
  const [contentReport, setContentReport] = useState<any>(null);
  const [contentExpanded, setContentExpanded] = useState(false);
  const [collab, setCollab] = useState<any>(null);
  const [collabExpanded, setCollabExpanded] = useState(false);
  const [digest, setDigest] = useState<any>(null);
  const [digestExpanded, setDigestExpanded] = useState(false);
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

    // Fetch burnout + content report data (non-blocking)
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const headers = { Authorization: `Bearer ${session.access_token}` };
        const [burnoutRes, contentRes, collabRes, digestRes] = await Promise.all([
          fetch(`${process.env.EXPO_PUBLIC_APP_URL}/api/burnout`, { headers }),
          fetch(`${process.env.EXPO_PUBLIC_APP_URL}/api/monetization`, { headers }),
          fetch(`${process.env.EXPO_PUBLIC_APP_URL}/api/collab`, { headers }),
          fetch(`${process.env.EXPO_PUBLIC_APP_URL}/api/digest`, { headers }),
        ]);
        if (burnoutRes.ok) setBurnout(await burnoutRes.json());
        if (contentRes.ok) setContentReport(await contentRes.json());
        if (collabRes.ok) setCollab(await collabRes.json());
        if (digestRes.ok) setDigest(await digestRes.json());
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
        {profile?.twitch_avatar_url ? (
          <Image source={{ uri: profile.twitch_avatar_url }} style={styles.headerAvatar} />
        ) : (
          <View style={[styles.headerAvatar, styles.headerAvatarFallback]}>
            <Text style={styles.headerAvatarText}>{(profile?.twitch_display_name || 'S')[0]}</Text>
          </View>
        )}
        <View style={styles.headerText}>
          <Text style={styles.greeting}>Hey, {profile?.twitch_display_name || '...'}</Text>
          <Text style={styles.greetingSub}>Here's what's happening</Text>
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
      {latestVod && (latestVod.coach_report as any)?.overall_score !== undefined && (() => {
        const s = (latestVod.coach_report as any).overall_score;
        const cardBorder = s >= 70 ? 'rgba(74,222,128,0.3)' : s >= 50 ? 'rgba(251,191,36,0.3)' : 'rgba(248,113,113,0.3)';
        const cardBg = s >= 70 ? 'rgba(74,222,128,0.04)' : s >= 50 ? 'rgba(251,191,36,0.04)' : 'rgba(248,113,113,0.04)';
        return (
        <TouchableOpacity style={[styles.scoreCard, { borderColor: cardBorder, backgroundColor: cardBg }]} onPress={() => router.push(`/vod/${latestVod.id}`)}>
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
        );
      })()}

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

      {/* Weekly Digest */}
      {digest?.locked
        ? <LockedCard title="Weekly Digest" description="Every Monday your manager sends a full week recap — streams, clips, follower growth, and your action plan." onUpgrade={() => router.push('/subscribe')} />
        : digest?.latest && <WeeklyDigestCard data={digest.latest} expanded={digestExpanded} onToggle={() => setDigestExpanded(!digestExpanded)} />}

      {/* Streamer Health */}
      {burnout?.locked
        ? <LockedCard title="Burnout Monitoring" description="Your manager tracks energy, frequency, and health signals weekly to keep you streaming without burning out." onUpgrade={() => router.push('/subscribe')} />
        : burnout?.latest && <BurnoutHealthCard data={burnout} expanded={burnoutExpanded} onToggle={() => setBurnoutExpanded(!burnoutExpanded)} />}

      {/* Content Performance */}
      {contentReport?.latest && <ContentPerformanceCard data={contentReport.latest} expanded={contentExpanded} onToggle={() => setContentExpanded(!contentExpanded)} />}

      {/* Collab Finder */}
      <CollabFinderCard collab={collab} expanded={collabExpanded} onToggle={() => setCollabExpanded(!collabExpanded)} />

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

function LockedCard({ title, description, onUpgrade }: { title: string; description: string; onUpgrade: () => void }) {
  return (
    <View style={styles.lockedCard}>
      <View style={styles.lockedIconWrap}>
        <Text style={styles.lockedIcon}>🔒</Text>
      </View>
      <Text style={styles.lockedTitle}>{title} is Pro</Text>
      <Text style={styles.lockedDesc}>{description}</Text>
      <TouchableOpacity style={styles.lockedBtn} onPress={onUpgrade}>
        <Text style={styles.lockedBtnText}>Upgrade to Pro</Text>
      </TouchableOpacity>
    </View>
  );
}

function burnoutColor(score: number) {
  if (score <= 25) return { bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.25)', text: colors.green, label: 'Healthy' };
  if (score <= 45) return { bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.25)', text: colors.yellow, label: 'Watch' };
  if (score <= 65) return { bg: 'rgba(251,146,60,0.08)', border: 'rgba(251,146,60,0.25)', text: '#fb923c', label: 'Warning' };
  return { bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.25)', text: colors.red, label: 'Alert' };
}

/** Fallback insight when Claude returns null */
function fallbackInsight(snap: any): string {
  const issues: string[] = [];
  if (snap.score_decline > 50) issues.push('your stream scores are trending down');
  if (snap.energy_decline > 50) issues.push('your energy has been inconsistent');
  if (snap.session_shortening > 50) issues.push('your sessions are getting shorter');
  if (snap.frequency_drop > 50) issues.push("you're streaming less frequently");
  if (snap.retention_risk > 50) issues.push('viewer retention risk is elevated');
  if (snap.growth_stall > 50) issues.push('follower growth has slowed');
  if (issues.length === 0) {
    return snap.score <= 25 ? "Everything looks good. You're in a solid rhythm." : 'A few minor signals this week, but nothing to worry about yet.';
  }
  const joined = issues.length === 1 ? issues[0] : issues.slice(0, -1).join(', ') + ' and ' + issues[issues.length - 1];
  return `Heads up: ${joined}. This isn't a big deal yet, but worth keeping an eye on.`;
}

function fallbackRecommendation(snap: any): string {
  if (snap.frequency_drop > 60) return 'Try to get back to your normal schedule this week, even if the streams are shorter.';
  if (snap.session_shortening > 60) return 'If your streams feel like a grind, take a day off and come back fresh. Short breaks help.';
  if (snap.energy_decline > 60) return 'Switch up your content or try a collab this week. A change of pace can reset your energy.';
  if (snap.score_decline > 60) return 'Review your last few coach reports and focus on the top improvement from each one.';
  if (snap.score <= 25) return 'Keep doing what you\'re doing. Consistency is your best growth tool right now.';
  return 'Focus on one small improvement from your latest coach report this week.';
}

function signalColor(value: number) {
  if (value <= 25) return colors.green;
  if (value <= 50) return colors.yellow;
  if (value <= 75) return '#fb923c';
  return colors.red;
}

function signalStatus(value: number) {
  if (value <= 25) return 'Good';
  if (value <= 50) return 'Okay';
  if (value <= 75) return 'Watch';
  return 'Concern';
}

function BurnoutHealthCard({ data, expanded, onToggle }: { data: any; expanded: boolean; onToggle: () => void }) {
  const latest = data.latest;
  const history: any[] = data.history || [];
  const bc = burnoutColor(latest.score);
  const healthPct = 100 - latest.score;
  const insight = latest.insight || fallbackInsight(latest);
  const recommendation = latest.recommendation || fallbackRecommendation(latest);

  const signals = [
    { label: 'Stream Scores', value: latest.score_decline },
    { label: 'Energy Level', value: latest.energy_decline },
    { label: 'Session Length', value: latest.session_shortening },
    { label: 'Stream Frequency', value: latest.frequency_drop },
    { label: 'Viewer Retention', value: latest.retention_risk },
    { label: 'Follower Growth', value: latest.growth_stall },
  ];

  return (
    <TouchableOpacity
      style={[styles.burnoutCard, { backgroundColor: bc.bg, borderColor: bc.border }]}
      onPress={onToggle}
      activeOpacity={0.8}
    >
      <View style={styles.burnoutHeader}>
        <Text style={styles.burnoutLabel}>STREAMER HEALTH</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[styles.burnoutStatus, { color: bc.text }]}>{bc.label}</Text>
          <Text style={{ fontSize: 12, color: colors.muted }}>{expanded ? '▲' : '▼'}</Text>
        </View>
      </View>
      <View style={styles.burnoutBarBg}>
        <View style={[styles.burnoutBarFill, { width: `${healthPct}%`, backgroundColor: bc.text }]} />
      </View>
      <Text style={styles.burnoutInsight}>{insight}</Text>

      {expanded && (
        <View style={styles.burnoutExpanded}>
          {/* Recommendation */}
          <View style={styles.burnoutRecCard}>
            <Text style={styles.burnoutRecTitle}>THIS WEEK'S FOCUS</Text>
            <Text style={styles.burnoutRecText}>{recommendation}</Text>
          </View>

          {/* Signal breakdown */}
          <Text style={styles.burnoutSignalTitle}>WHAT WE'RE WATCHING</Text>
          {signals.map((s) => (
            <View key={s.label} style={styles.signalRow}>
              <Text style={styles.signalLabel}>{s.label}</Text>
              <View style={styles.signalBarBg}>
                <View style={[styles.signalBarFill, { width: `${Math.min(s.value, 100)}%`, backgroundColor: signalColor(s.value) }]} />
              </View>
              <Text style={[styles.signalStatus, { color: signalColor(s.value) }]}>{signalStatus(s.value)}</Text>
            </View>
          ))}

          {/* Sparkline */}
          {history.length > 1 && (
            <View style={{ marginTop: 14 }}>
              <Text style={styles.burnoutSignalTitle}>HEALTH TREND</Text>
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
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

function formatWeekDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function WeeklyDigestCard({ data, expanded, onToggle }: { data: any; expanded: boolean; onToggle: () => void }) {
  const followerDelta = data.follower_delta ?? 0;
  const deltaColor = followerDelta >= 0 ? colors.green : colors.red;
  const deltaStr = `${followerDelta >= 0 ? '+' : ''}${followerDelta}`;
  const actions: string[] = data.action_items || [];

  return (
    <TouchableOpacity
      style={styles.digestCard}
      onPress={onToggle}
      activeOpacity={0.8}
    >
      <View style={styles.digestHeader}>
        <Text style={styles.digestLabel}>WEEKLY DIGEST</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.digestDate}>{formatWeekDate(data.week_start)}</Text>
          <Text style={{ fontSize: 12, color: colors.muted }}>{expanded ? '▲' : '▼'}</Text>
        </View>
      </View>

      <Text style={styles.digestHeadline}>{data.headline}</Text>

      <View style={styles.digestQuickStats}>
        <Text style={styles.digestStat}>{data.streams_count || 0} stream{(data.streams_count || 0) !== 1 ? 's' : ''}</Text>
        {data.avg_score != null && <Text style={styles.digestStat}>avg {data.avg_score}</Text>}
        <Text style={[styles.digestStat, { color: deltaColor }]}>{deltaStr} followers</Text>
      </View>

      {expanded && (
        <View style={styles.digestExpanded}>
          <View style={styles.digestMiniStats}>
            <View style={styles.digestMiniStat}>
              <Text style={styles.digestMiniValue}>{data.total_duration_min}m</Text>
              <Text style={styles.digestMiniLabel}>DURATION</Text>
            </View>
            <View style={styles.digestMiniStat}>
              <Text style={styles.digestMiniValue}>{data.peaks_found}</Text>
              <Text style={styles.digestMiniLabel}>PEAKS</Text>
            </View>
            <View style={styles.digestMiniStat}>
              <Text style={styles.digestMiniValue}>{data.clips_generated}</Text>
              <Text style={styles.digestMiniLabel}>CLIPS</Text>
            </View>
          </View>

          {data.health_summary && (
            <View style={styles.digestSummaryRow}>
              <Text style={styles.digestSummaryLabel}>Health</Text>
              <Text style={styles.digestSummaryText}>{data.health_summary}</Text>
            </View>
          )}
          {data.content_summary && (
            <View style={styles.digestSummaryRow}>
              <Text style={styles.digestSummaryLabel}>Content</Text>
              <Text style={styles.digestSummaryText}>{data.content_summary}</Text>
            </View>
          )}
          {data.collab_summary && (
            <View style={styles.digestSummaryRow}>
              <Text style={styles.digestSummaryLabel}>Collabs</Text>
              <Text style={styles.digestSummaryText}>{data.collab_summary}</Text>
            </View>
          )}

          {actions.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.digestActionsTitle}>THIS WEEK'S ACTIONS</Text>
              {actions.map((item: string, i: number) => (
                <View key={i} style={styles.digestActionRow}>
                  <Text style={styles.digestActionDot}>→</Text>
                  <Text style={styles.digestActionText}>{item}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

function CollabFinderCard({ collab, expanded, onToggle }: { collab: any; expanded: boolean; onToggle: () => void }) {
  const [joining, setJoining] = useState(false);
  const profile = collab?.profile;
  const suggestions: any[] = collab?.suggestions || [];

  const handleOptIn = async () => {
    setJoining(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await fetch(`${process.env.EXPO_PUBLIC_APP_URL}/api/collab`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: true }),
        });
      }
    } catch {}
    setJoining(false);
  };

  // Not opted in
  if (!profile?.enabled) {
    return (
      <View style={styles.collabCard}>
        <Text style={styles.collabLabel}>COLLAB FINDER</Text>
        <Text style={styles.collabInsight}>Find streamers to collab with based on your content style, audience size, and strengths.</Text>
        <TouchableOpacity style={styles.collabOptInBtn} onPress={handleOptIn} disabled={joining}>
          <Text style={styles.collabOptInText}>{joining ? 'Joining...' : 'Join Collab Matching'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Opted in, no suggestions
  if (suggestions.length === 0) {
    return (
      <View style={[styles.collabCard, { borderColor: 'rgba(124,58,237,0.2)', backgroundColor: 'rgba(124,58,237,0.04)' }]}>
        <Text style={styles.collabLabel}>COLLAB FINDER</Text>
        <Text style={styles.collabInsight}>You're in the matching pool. We'll find collab partners for you every Monday.</Text>
      </View>
    );
  }

  // Has suggestions
  return (
    <TouchableOpacity
      style={[styles.collabCard, { borderColor: 'rgba(124,58,237,0.2)', backgroundColor: 'rgba(124,58,237,0.04)' }]}
      onPress={onToggle}
      activeOpacity={0.8}
    >
      <View style={styles.collabHeader}>
        <Text style={styles.collabLabel}>COLLAB FINDER</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.collabMatchCount}>{suggestions.length} match{suggestions.length !== 1 ? 'es' : ''}</Text>
          <Text style={{ fontSize: 12, color: colors.muted }}>{expanded ? '▲' : '▼'}</Text>
        </View>
      </View>

      <Text style={styles.collabInsight}>
        Top match: <Text style={{ fontWeight: '700', color: colors.text }}>{suggestions[0].display_name}</Text>
        {' — '}{suggestions[0].reasons?.[0] || 'Great potential collab partner'}
      </Text>

      {expanded && (
        <View style={styles.collabExpanded}>
          {suggestions.map((s: any) => (
            <View key={s.id} style={styles.collabMatchRow}>
              {s.avatar_url ? (
                <Image source={{ uri: s.avatar_url }} style={styles.collabAvatar} />
              ) : (
                <View style={[styles.collabAvatar, { backgroundColor: 'rgba(124,58,237,0.2)', alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ color: colors.accentLight, fontSize: 14, fontWeight: '700' }}>{s.display_name?.[0] || '?'}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Text style={styles.collabMatchName}>{s.display_name}</Text>
                  <Text style={styles.collabMatchScore}>{s.match_score}%</Text>
                  {s.is_external && <Text style={styles.collabExternalBadge}>Twitch</Text>}
                </View>
                {s.follower_count > 0 && (
                  <Text style={{ fontSize: 10, color: colors.muted, marginBottom: 3 }}>{s.follower_count?.toLocaleString()} followers</Text>
                )}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                  {(s.reasons || []).map((r: string, i: number) => (
                    <Text key={i} style={styles.collabReason}>{r}</Text>
                  ))}
                </View>
              </View>
              <View style={{ gap: 6 }}>
                {s.twitch_login && (
                  <TouchableOpacity onPress={() => Linking.openURL(`https://twitch.tv/message/compose?to=${s.twitch_login}`)} style={styles.collabMessageBtn}>
                    <Text style={styles.collabMessageBtnText}>Message</Text>
                  </TouchableOpacity>
                )}
                {s.twitch_login && (
                  <TouchableOpacity onPress={() => Linking.openURL(`https://twitch.tv/${s.twitch_login}`)} style={styles.collabTwitchBtn}>
                    <Text style={styles.collabTwitchBtnText}>View</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  hype: 'Hype', funny: 'Comedy', educational: 'Educational', emotional: 'Emotional',
  clutch_play: 'Clutch Plays', rage: 'Rage', wholesome: 'Wholesome',
};

function contentFallbackInsight(report: any): string {
  const cats = report.category_breakdown || [];
  if (cats.length === 0) return "We're analyzing your content mix. Check back after a few more streams.";
  const top = cats[0];
  const label = CATEGORY_LABELS[top.category] || top.category;
  if (top.growth_rating === 'high') {
    return `Your ${label.toLowerCase()} content is your strongest performer with an avg score of ${top.avg_score} across ${top.vod_count} streams.`;
  }
  return `You've streamed ${cats.length} content styles recently. ${label} content leads with a ${top.avg_score} avg score.`;
}

function contentFallbackRec(report: any): string {
  const cats = report.category_breakdown || [];
  if (cats.length === 0) return 'Keep streaming and we\'ll start tracking which content types work best for your growth.';
  const top = cats[0];
  const label = CATEGORY_LABELS[top.category] || top.category;
  if (cats.length === 1) return `You've been consistent with ${label.toLowerCase()} content. Try mixing in a different style to see how your audience responds.`;
  return `Double down on ${label.toLowerCase()} content this week — it's driving the most growth for your channel.`;
}

function ratingColor(rating: string) {
  if (rating === 'high') return colors.green;
  if (rating === 'medium') return colors.yellow;
  return colors.muted;
}

function ContentPerformanceCard({ data, expanded, onToggle }: { data: any; expanded: boolean; onToggle: () => void }) {
  const categories: any[] = data.category_breakdown || [];
  if (categories.length === 0) return null;

  const insight = data.insight || contentFallbackInsight(data);
  const recommendation = data.recommendation || contentFallbackRec(data);
  const topLabel = data.top_category ? (CATEGORY_LABELS[data.top_category] || data.top_category) : null;

  return (
    <TouchableOpacity
      style={[styles.contentCard]}
      onPress={onToggle}
      activeOpacity={0.8}
    >
      <View style={styles.contentHeader}>
        <Text style={styles.contentLabel}>CONTENT PERFORMANCE</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {topLabel && <Text style={styles.contentTopCat}>{topLabel}</Text>}
          <Text style={{ fontSize: 12, color: colors.muted }}>{expanded ? '▲' : '▼'}</Text>
        </View>
      </View>

      <Text style={styles.contentInsight}>{insight}</Text>

      {expanded && (
        <View style={styles.contentExpanded}>
          <View style={styles.contentRecCard}>
            <Text style={styles.contentRecTitle}>THIS WEEK'S STRATEGY</Text>
            <Text style={styles.contentRecText}>{recommendation}</Text>
          </View>

          <Text style={styles.contentBreakdownTitle}>CATEGORY BREAKDOWN</Text>
          {categories.map((cat: any) => {
            const label = CATEGORY_LABELS[cat.category] || cat.category;
            const deltaStr = cat.follower_delta >= 0 ? `+${cat.follower_delta}` : `${cat.follower_delta}`;
            return (
              <View key={cat.category} style={[styles.catRow, { borderColor: ratingColor(cat.growth_rating) + '33' }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.catName}>{label}</Text>
                  <Text style={styles.catDetail}>
                    {cat.vod_count} stream{cat.vod_count !== 1 ? 's' : ''} · avg {cat.avg_score} · {cat.total_peaks} peak{cat.total_peaks !== 1 ? 's' : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.catDelta, { color: cat.follower_delta >= 0 ? colors.green : colors.red }]}>{deltaStr}</Text>
                  <Text style={styles.catDeltaLabel}>followers</Text>
                </View>
              </View>
            );
          })}
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  headerAvatar: { width: 42, height: 42, borderRadius: 21, marginRight: 12, flexShrink: 0 },
  headerAvatarFallback: { backgroundColor: 'rgba(124,58,237,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { color: colors.accentLight, fontSize: 16, fontWeight: '800' },
  headerText: { flex: 1, marginRight: 8 },
  greeting: { fontSize: 16, fontWeight: '800', color: colors.text, letterSpacing: -0.3, marginBottom: 1 },
  greetingSub: { fontSize: 12, color: colors.muted },
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
  lockedCard: { backgroundColor: 'rgba(124,58,237,0.06)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(124,58,237,0.2)', padding: 20, marginBottom: 24, alignItems: 'center' },
  lockedIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(124,58,237,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  lockedIcon: { fontSize: 20 },
  lockedTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 6, textAlign: 'center' },
  lockedDesc: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19, marginBottom: 16 },
  lockedBtn: { backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10 },
  lockedBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  burnoutCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 24 },
  burnoutHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  burnoutLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, letterSpacing: 1 },
  burnoutStatus: { fontSize: 13, fontWeight: '700' },
  burnoutBarBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden', marginBottom: 10 },
  burnoutBarFill: { height: '100%', borderRadius: 3 },
  burnoutInsight: { fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 19 },
  burnoutExpanded: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  burnoutRecCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 14, marginBottom: 14 },
  burnoutRecTitle: { fontSize: 10, fontWeight: '700', color: colors.muted, letterSpacing: 1, marginBottom: 6 },
  burnoutRecText: { fontSize: 13, color: 'rgba(255,255,255,0.9)', lineHeight: 19 },
  burnoutSignalTitle: { fontSize: 10, fontWeight: '700', color: colors.muted, letterSpacing: 1, marginBottom: 10 },
  signalRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  signalLabel: { fontSize: 11, color: colors.muted, width: 100 },
  signalBarBg: { flex: 1, height: 5, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' },
  signalBarFill: { height: '100%', borderRadius: 3 },
  signalStatus: { fontSize: 11, fontWeight: '700', width: 52, textAlign: 'right' },
  burnoutSparkline: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 24 },
  burnoutBar: { flex: 1, borderRadius: 2, minHeight: 4 },
  contentCard: { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(124,58,237,0.2)', backgroundColor: 'rgba(124,58,237,0.04)', padding: 16, marginBottom: 24 },
  contentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  contentLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, letterSpacing: 1 },
  contentTopCat: { fontSize: 13, fontWeight: '700', color: colors.accentLight },
  contentInsight: { fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 19 },
  contentExpanded: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  contentRecCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 14, marginBottom: 14 },
  contentRecTitle: { fontSize: 10, fontWeight: '700', color: colors.muted, letterSpacing: 1, marginBottom: 6 },
  contentRecText: { fontSize: 13, color: 'rgba(255,255,255,0.9)', lineHeight: 19 },
  contentBreakdownTitle: { fontSize: 10, fontWeight: '700', color: colors.muted, letterSpacing: 1, marginBottom: 10 },
  catRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.02)' },
  catName: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 2 },
  catDetail: { fontSize: 11, color: colors.muted },
  catDelta: { fontSize: 14, fontWeight: '800' },
  catDeltaLabel: { fontSize: 9, color: colors.muted },
  collabCard: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 16, marginBottom: 24 },
  collabHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  collabLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, letterSpacing: 1, marginBottom: 10 },
  collabInsight: { fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 19 },
  collabOptInBtn: { backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, marginTop: 14, alignSelf: 'flex-start' },
  collabOptInText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  collabMatchCount: { fontSize: 13, fontWeight: '700', color: colors.accentLight },
  collabExpanded: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', gap: 10 },
  collabMatchRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  collabAvatar: { width: 36, height: 36, borderRadius: 18 },
  collabMatchName: { fontSize: 14, fontWeight: '700', color: colors.text },
  collabMatchScore: { fontSize: 12, fontWeight: '800', color: colors.accentLight },
  collabReason: { fontSize: 10, color: colors.muted, backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  collabExternalBadge: { fontSize: 9, color: '#60a5fa', backgroundColor: 'rgba(96,165,250,0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, fontWeight: '700', overflow: 'hidden' },
  collabMessageBtn: { backgroundColor: 'rgba(124,58,237,0.25)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  collabMessageBtnText: { color: colors.accentLight, fontSize: 11, fontWeight: '700' },
  collabTwitchBtn: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  collabTwitchBtnText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  digestCard: { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.03)', padding: 16, marginBottom: 24 },
  digestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  digestLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, letterSpacing: 1 },
  digestDate: { fontSize: 11, color: colors.muted },
  digestHeadline: { fontSize: 14, fontWeight: '700', color: colors.text, lineHeight: 20, marginBottom: 8 },
  digestQuickStats: { flexDirection: 'row', gap: 12 },
  digestStat: { fontSize: 12, color: colors.muted },
  digestExpanded: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  digestMiniStats: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  digestMiniStat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 10, alignItems: 'center' },
  digestMiniValue: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 2 },
  digestMiniLabel: { fontSize: 9, fontWeight: '700', color: colors.muted, letterSpacing: 0.5 },
  digestSummaryRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  digestSummaryLabel: { fontSize: 10, fontWeight: '700', color: colors.muted, width: 52, paddingTop: 2 },
  digestSummaryText: { fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 18, flex: 1 },
  digestActionsTitle: { fontSize: 10, fontWeight: '700', color: colors.muted, letterSpacing: 1, marginBottom: 8 },
  digestActionRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  digestActionDot: { fontSize: 11, color: colors.accentLight, fontWeight: '700', marginTop: 2 },
  digestActionText: { fontSize: 13, color: 'rgba(255,255,255,0.9)', lineHeight: 18, flex: 1 },
});
