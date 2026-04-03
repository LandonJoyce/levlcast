import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, ActivityIndicator, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { restorePurchases } from '@/lib/revenuecat';
import { colors } from '@/lib/colors';

export default function SettingsScreen() {
  const [profile, setProfile] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [restoring, setRestoring] = useState(false);
  const router = useRouter();

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [profileRes, usageRes] = await Promise.all([
      supabase.from('profiles').select('twitch_display_name, twitch_login, twitch_avatar_url, plan').eq('id', user.id).single(),
      supabase.from('usage_logs').select('*').eq('user_id', user.id).single(),
    ]);

    setProfile(profileRes.data);
    setUsage(usageRes.data);
  }

  async function handleRestore() {
    setRestoring(true);
    const isPro = await restorePurchases();
    setRestoring(false);
    if (isPro) {
      Alert.alert('Restored', 'Your Pro subscription has been restored.');
      loadData();
    } else {
      Alert.alert('No active subscription found', 'If you believe this is an error, contact support.');
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  async function handleDeleteAccount() {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data: { session } } = await supabase.auth.getSession();
              if (!session) {
                Alert.alert('Not signed in', 'Please sign in again before deleting your account.');
                return;
              }

              const res = await fetch(`${process.env.EXPO_PUBLIC_APP_URL}/api/account/delete`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${session.access_token}` },
              });

              if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.error || `Server error ${res.status}`);
              }

              await supabase.auth.signOut();
              router.replace('/login');
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Could not delete account. Please contact support at mototoka14@gmail.com.');
            }
          },
        },
      ]
    );
  }

  const isPro = profile?.plan === 'pro';
  const analysesUsed = usage?.analyses_this_month || 0;
  const analysesLimit = isPro ? 999 : 1;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Account */}
      <Text style={styles.sectionLabel}>Account</Text>
      <View style={styles.card}>
        <Text style={styles.displayName}>{profile?.twitch_display_name || '...'}</Text>
        <Text style={styles.login}>@{profile?.twitch_login || '...'}</Text>
      </View>

      {/* Subscription */}
      <Text style={styles.sectionLabel}>Subscription</Text>
      <View style={styles.card}>
        <View style={styles.planRow}>
          <Text style={styles.planName}>{isPro ? 'Pro' : 'Free'}</Text>
          <View style={[styles.planBadge, isPro && styles.planBadgePro]}>
            <Text style={[styles.planBadgeText, isPro && styles.planBadgeTextPro]}>
              {isPro ? 'Active' : 'Free Plan'}
            </Text>
          </View>
        </View>

        {!isPro && (
          <>
            <View style={styles.usageRow}>
              <Text style={styles.usageLabel}>VOD analyses this month</Text>
              <Text style={styles.usageValue}>{analysesUsed} / {analysesLimit}</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${Math.min((analysesUsed / analysesLimit) * 100, 100)}%` }]} />
            </View>

            <TouchableOpacity style={styles.upgradeBtn} onPress={() => router.push('/subscribe')}>
              <Text style={styles.upgradeBtnText}>Upgrade to Pro</Text>
            </TouchableOpacity>

            {/* Required: subscription disclosure */}
            <Text style={styles.disclosure}>
              Subscription automatically renews monthly unless cancelled at least 24 hours before the end of the current period. Manage in App Store settings.
            </Text>
          </>
        )}

        {/* Required: Restore Purchases button */}
        <TouchableOpacity style={styles.restoreBtn} onPress={handleRestore} disabled={restoring}>
          {restoring ? (
            <ActivityIndicator color={colors.accentLight} size="small" />
          ) : (
            <Text style={styles.restoreBtnText}>Restore Purchases</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Legal links — required for App Store */}
      <Text style={styles.sectionLabel}>Legal</Text>
      <View style={styles.card}>
        <TouchableOpacity style={styles.legalRow} onPress={() => Linking.openURL('https://levlcast.com/privacy')}>
          <Text style={styles.legalText}>Privacy Policy</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.legalRow} onPress={() => Linking.openURL('https://levlcast.com/terms')}>
          <Text style={styles.legalText}>Terms of Service</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.legalRow} onPress={() => Linking.openURL('mailto:mototoka14@gmail.com')}>
          <Text style={styles.legalText}>Contact Support</Text>
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

      {/* Delete Account — required by Apple Guideline 5.1.1(v) */}
      <Text style={styles.sectionLabel}>Account Management</Text>
      <View style={styles.deleteCard}>
        <Text style={styles.deleteCardTitle}>Delete Account</Text>
        <Text style={styles.deleteCardDesc}>
          Permanently delete your account and all associated data. This action cannot be undone.
        </Text>
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount}>
          <Text style={styles.deleteBtnText}>Delete Account</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 60 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10, marginTop: 8 },
  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 20, marginBottom: 20 },
  displayName: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 2 },
  login: { fontSize: 13, color: colors.muted },
  planRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  planName: { fontSize: 18, fontWeight: '800', color: colors.text },
  planBadge: { backgroundColor: colors.surface2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: colors.border },
  planBadgePro: { backgroundColor: 'rgba(124,58,237,0.15)', borderColor: colors.accentLight },
  planBadgeText: { fontSize: 12, fontWeight: '700', color: colors.muted },
  planBadgeTextPro: { color: colors.accentLight },
  usageRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  usageLabel: { fontSize: 13, color: colors.muted },
  usageValue: { fontSize: 13, fontWeight: '700', color: colors.text },
  progressBar: { height: 4, backgroundColor: colors.surface2, borderRadius: 2, marginBottom: 20, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 2 },
  upgradeBtn: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
  upgradeBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  disclosure: { fontSize: 11, color: colors.muted, lineHeight: 16, marginBottom: 12 },
  restoreBtn: { alignItems: 'center', paddingVertical: 10 },
  restoreBtnText: { fontSize: 14, color: colors.accentLight, fontWeight: '600' },
  legalRow: { paddingVertical: 14 },
  legalText: { fontSize: 15, color: colors.text },
  divider: { height: 1, backgroundColor: colors.border },
  logoutBtn: { alignItems: 'center', paddingVertical: 16, marginTop: 8 },
  logoutText: { fontSize: 15, color: colors.red, fontWeight: '600' },
  deleteCard: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)', padding: 20, marginBottom: 20 },
  deleteCardTitle: { fontSize: 16, fontWeight: '700', color: colors.red, marginBottom: 6 },
  deleteCardDesc: { fontSize: 13, color: colors.muted, lineHeight: 18, marginBottom: 16 },
  deleteBtn: { backgroundColor: 'rgba(248,113,113,0.12)', borderRadius: 10, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(248,113,113,0.4)' },
  deleteBtnText: { fontSize: 14, color: colors.red, fontWeight: '700' },
});
