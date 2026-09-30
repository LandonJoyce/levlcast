import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { ChevronRight } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { getCustomerInfo, restorePurchases } from '@/lib/revenuecat';
import { colors, fonts } from '@/lib/theme';
import { Bar, Button, Hairline, Label, Loading, PageTitle, Screen, Tag } from '@/lib/ui';
import { api, getUsage, type Usage } from '@/lib/api';

/*
 * Account: who you are, your plan and what's left of it, and the things
 * Apple asks every app to have (restore, manage, legal, delete).
 */

export default function AccountScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  // Null when the App Store couldn't be asked: then the Apple link shows anyway.
  const [appleActive, setAppleActive] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }
      const [profileRes, u, info] = await Promise.all([
        supabase.from('profiles').select('twitch_display_name, twitch_login, twitch_avatar_url, plan').eq('id', user.id).single(),
        getUsage(),
        getCustomerInfo(),
      ]);
      setProfile(profileRes.data);
      setUsage(u);
      setAppleActive(info ? !!info.entitlements?.active?.['pro'] : null);
    } catch (err: any) {
      setError(err?.message || "Couldn't load your account");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function restore() {
    setRestoring(true);
    const ok = await restorePurchases();
    setRestoring(false);
    if (ok) {
      Alert.alert('Restored', 'Your Pro subscription is active. It can take a minute to show everywhere.');
      load();
    } else {
      Alert.alert('Nothing to restore', "We didn't find an active subscription on this Apple ID.");
    }
  }

  async function logOut() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  function deleteAccount() {
    Alert.alert('Delete your account?', 'This permanently deletes your account, reports and clips. It can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const r = await api('/api/account/delete', { method: 'DELETE' });
          if (!r.ok) {
            Alert.alert("Couldn't delete it", r.data?.error || 'Email support@levlcast.com and we’ll do it for you.');
            return;
          }
          await supabase.auth.signOut();
          router.replace('/login');
        },
      },
    ]);
  }

  if (loading) return <Loading />;

  const isPro = usage?.plan === 'pro' || profile?.plan === 'pro';
  const planName = !isPro ? 'Free' : usage?.pro_plus ? 'Pro Plus' : usage?.founding_member ? 'Pro · Founding' : 'Pro';

  const rows = usage
    ? [
        { label: `Reports ${usage.period_label}`, used: usage.analyses_used, limit: usage.analyses_limit, unit: '' },
        ...(isPro ? [{ label: 'Hours this month', used: usage.hours_used, limit: usage.hours_limit, unit: 'h' }] : []),
        { label: `Clips ${usage.clips_period_label ?? 'this month'}`, used: usage.clips_used, limit: usage.clips_limit, unit: '' },
      ]
    : [];

  return (
    <Screen>
      <PageTitle>Account</PageTitle>
      {error ? <Text style={[s.small, { color: colors.danger }]}>{error}</Text> : null}

      <View style={s.me}>
        {profile?.twitch_avatar_url ? (
          <Image source={{ uri: profile.twitch_avatar_url }} style={s.avatar} />
        ) : (
          <View style={[s.avatar, s.avatarEmpty]}>
            <Text style={s.avatarLetter}>{(profile?.twitch_display_name || 'S').slice(0, 1).toUpperCase()}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={s.name} numberOfLines={1}>{profile?.twitch_display_name || 'Your account'}</Text>
          {profile?.twitch_login ? <Text style={s.login}>twitch.tv/{profile.twitch_login}</Text> : null}
        </View>
      </View>
      <Hairline />

      <View style={s.block}>
        <Label style={{ marginBottom: 10 }}>Your plan</Label>
        <View style={s.planRow}>
          <Text style={s.plan}>{planName}</Text>
          {isPro ? <Tag text="Active" color={colors.green} /> : null}
        </View>

        {rows.length > 0 ? (
          <View style={{ gap: 16, marginTop: 20 }}>
            {rows.map((r) => (
              <View key={r.label}>
                <View style={s.usageLine}>
                  <Text style={s.usageLabel}>{r.label}</Text>
                  <Text style={s.usageVal}>
                    {r.used}
                    {r.unit} of {r.limit}
                    {r.unit}
                  </Text>
                </View>
                <Bar fraction={r.limit > 0 ? r.used / r.limit : 0} color={r.used >= r.limit ? colors.danger : colors.ink} height={5} />
              </View>
            ))}
          </View>
        ) : (
          <ActivityIndicator style={{ marginTop: 16, alignSelf: 'flex-start' }} color={colors.ink3} />
        )}

        {!isPro ? (
          <>
            <Text style={s.small}>Free coaches the first 2 hours of a stream, once a week. Pro coaches whole streams, 20 reports a month.</Text>
            <Button title="Go Pro" onPress={() => router.push('/subscribe')} style={{ marginTop: 18 }} />
          </>
        ) : appleActive !== false ? (
          <Button
            title="Manage subscription"
            kind="ghost"
            onPress={() => Linking.openURL('https://apps.apple.com/account/subscriptions')}
            style={{ marginTop: 20 }}
          />
        ) : (
          <Text style={s.small}>Your plan isn&apos;t billed through the App Store, so there&apos;s nothing to manage here.</Text>
        )}
        <Pressable onPress={restore} disabled={restoring} hitSlop={8} style={{ marginTop: 16, alignSelf: 'flex-start' }}>
          {restoring ? <ActivityIndicator color={colors.ink3} size="small" /> : <Text style={s.linkText}>Restore purchases</Text>}
        </Pressable>
      </View>
      <Hairline />

      <View style={s.list}>
        {[
          ['Privacy Policy', () => Linking.openURL('https://levlcast.com/privacy')],
          ['Terms of Service', () => Linking.openURL('https://levlcast.com/terms')],
          ['Contact support', () => Linking.openURL('mailto:support@levlcast.com')],
        ].map(([label, go]) => (
          <Pressable key={label as string} onPress={go as () => void} style={({ pressed }) => [s.listRow, pressed && { backgroundColor: colors.wash }]}>
            <Text style={s.listText}>{label as string}</Text>
            <ChevronRight size={16} color={colors.ink4} />
          </Pressable>
        ))}
      </View>

      <Button title="Log out" kind="ghost" onPress={logOut} style={{ marginTop: 28 }} />

      <View style={s.danger}>
        <Label color={colors.danger} style={{ marginBottom: 8 }}>Delete account</Label>
        <Text style={s.small}>Permanently deletes your account and everything in it: reports, rank and clips.</Text>
        <Button title="Delete my account" kind="danger" onPress={deleteAccount} style={{ marginTop: 14, alignSelf: 'flex-start' }} />
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  small: { marginTop: 12, fontSize: 13, lineHeight: 19, color: colors.ink3 },
  me: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 22, marginTop: 8 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface2 },
  avatarLetter: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  name: { fontFamily: fonts.display, fontSize: 19, letterSpacing: -0.3, color: colors.ink },
  login: { marginTop: 3, fontFamily: fonts.mono, fontSize: 12, color: colors.ink3 },
  block: { paddingVertical: 24 },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  plan: { fontFamily: fonts.numbers, fontSize: 44, lineHeight: 46, textTransform: 'uppercase', color: colors.ink },
  usageLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  usageLabel: { fontSize: 14, color: colors.ink2 },
  usageVal: { fontFamily: fonts.mono, fontSize: 12, color: colors.ink },
  linkText: { fontSize: 14, fontWeight: '600', color: colors.ink2, textDecorationLine: 'underline' },
  list: { marginTop: 8 },
  listRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.line },
  listText: { fontSize: 15, color: colors.ink },
  danger: { marginTop: 36, padding: 18, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)' },
});
