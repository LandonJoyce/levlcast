import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { supabase } from '@/lib/supabase';
import { getProPackages, purchasePro, restorePurchases } from '@/lib/revenuecat';
import { colors, fonts } from '@/lib/theme';
import { Button, Label, Screen, Tag } from '@/lib/ui';

/*
 * LevlCast Pro, bought through the App Store. The same plan as the site's:
 * whole streams, 20 reports and 30 hours a month, 20 clips. Every price on
 * this screen comes from the App Store.
 */

const FEATURES = [
  'Whole streams coached, up to 8 hours each',
  '20 reports a month, up to 30 hours',
  '20 clips a month',
  'Post clips to YouTube Shorts',
  'What keeps coming back across your streams',
];

export default function SubscribeScreen() {
  const router = useRouter();
  const [monthly, setMonthly] = useState<PurchasesPackage | null>(null);
  const [annual, setAnnual] = useState<PurchasesPackage | null>(null);
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('monthly');
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const loadPrices = useCallback(async () => {
    setLoading(true);
    const p = await getProPackages();
    setMonthly(p.monthly);
    setAnnual(p.annual);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPrices();
  }, [loadPrices]);

  const pkg = cycle === 'annual' ? annual ?? monthly : monthly;
  const product = pkg?.product;
  const isAnnual = cycle === 'annual' && !!annual;
  const save =
    monthly && annual && monthly.product.price > 0
      ? Math.round((1 - annual.product.price / (monthly.product.price * 12)) * 100)
      : 0;

  /** The purchase grants Pro through RevenueCat's webhook; wait for it so the app shows Pro right away. */
  async function waitForPro() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    for (let i = 0; i < 8; i++) {
      const { data } = await supabase.from('profiles').select('plan').eq('id', user.id).single();
      if (data?.plan === 'pro') return;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  async function buy() {
    if (!pkg) return;
    setPurchasing(true);
    const r = await purchasePro(pkg);
    if (r.ok) {
      await waitForPro();
      setPurchasing(false);
      Alert.alert("You're Pro", 'Every stream gets coached start to finish now.', [{ text: "Let's go", onPress: () => router.back() }]);
      return;
    }
    setPurchasing(false);
    if (!r.cancelled) Alert.alert("That didn't go through", r.message ?? 'Nothing was charged. Try again in a minute.');
  }

  async function restore() {
    setRestoring(true);
    const ok = await restorePurchases();
    setRestoring(false);
    if (ok) {
      Alert.alert('Restored', 'Your Pro subscription is active.', [{ text: 'OK', onPress: () => router.back() }]);
    } else {
      Alert.alert('Nothing to restore', "We didn't find an active subscription on this Apple ID.");
    }
  }

  return (
    <Screen inset={false}>
      <Label>LevlCast Pro</Label>
      <Text style={s.title}>Coach the whole stream, every time.</Text>
      <Text style={s.sub}>Free coaches the first 2 hours of one stream a week. Pro coaches all of it, every stream.</Text>

      {annual && monthly ? (
        <View style={s.toggle}>
          {(['monthly', 'annual'] as const).map((c) => (
            <Pressable key={c} onPress={() => setCycle(c)} style={[s.toggleOpt, cycle === c && s.toggleOn]}>
              <Text style={[s.toggleText, cycle === c && { color: colors.bg }]}>{c === 'monthly' ? 'Monthly' : 'Yearly'}</Text>
              {c === 'annual' && save >= 5 ? (
                <Text style={[s.toggleSave, cycle === c && { color: colors.bg }]}>Save {save}%</Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={s.price}>
        {loading ? (
          <ActivityIndicator color={colors.ink3} />
        ) : product ? (
          <>
            <View style={s.priceRow}>
              <Text style={s.amount}>{product.priceString}</Text>
              <Text style={s.per}>{isAnnual ? '/ year' : '/ month'}</Text>
            </View>
            <Text style={s.priceNote}>
              {isAnnual && product.pricePerMonthString ? `About ${product.pricePerMonthString} a month. ` : ''}Cancel anytime in your App Store
              settings.
            </Text>
          </>
        ) : (
          <>
            <Text style={s.priceNote}>Couldn&apos;t load prices from the App Store.</Text>
            <Button title="Try again" kind="ghost" small onPress={loadPrices} style={{ marginTop: 12, alignSelf: 'flex-start' }} />
          </>
        )}
      </View>

      <View style={s.features}>
        {FEATURES.map((f) => (
          <View key={f} style={s.feature}>
            <Check size={16} color={colors.green} strokeWidth={2.4} />
            <Text style={s.featureText}>{f}</Text>
          </View>
        ))}
      </View>

      <Button title={isAnnual ? 'Get Pro for a year' : 'Get Pro'} onPress={buy} loading={purchasing} disabled={!pkg || loading} />
      <View style={s.freeRow}>
        <Tag text="Free" color={colors.ink3} />
        <Text style={s.freeText}>1 report a week (first 2 hours), 6 clips a month.</Text>
      </View>

      <Pressable onPress={restore} disabled={restoring} hitSlop={8} style={s.restore}>
        {restoring ? <ActivityIndicator color={colors.ink3} size="small" /> : <Text style={s.restoreText}>Restore purchases</Text>}
      </Pressable>

      <Text style={s.disclosure}>
        {product
          ? `${product.priceString} ${isAnnual ? 'a year' : 'a month'} is charged to your Apple ID when you confirm. `
          : 'Payment is charged to your Apple ID when you confirm. '}
        The subscription renews automatically unless you turn off auto-renew at least 24 hours before the end of the current period. Manage or
        cancel it in your App Store account settings.
      </Text>
      <View style={s.legal}>
        <Text style={s.legalLink} onPress={() => Linking.openURL('https://levlcast.com/terms')}>
          Terms of Use
        </Text>
        <Text style={s.legalDot}> {'·'} </Text>
        <Text style={s.legalLink} onPress={() => Linking.openURL('https://levlcast.com/privacy')}>
          Privacy Policy
        </Text>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  title: { marginTop: 10, fontFamily: fonts.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.7, color: colors.ink },
  sub: { marginTop: 10, fontSize: 15, lineHeight: 22, color: colors.ink3 },
  toggle: { flexDirection: 'row', marginTop: 24, padding: 4, borderRadius: 11, borderWidth: 1, borderColor: colors.line2 },
  toggleOpt: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 8 },
  toggleOn: { backgroundColor: colors.ink },
  toggleText: { fontSize: 14, fontWeight: '700', color: colors.ink2 },
  toggleSave: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.green },
  price: { minHeight: 96, justifyContent: 'center', marginTop: 22, paddingVertical: 18, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  amount: { fontFamily: fonts.numbers, fontSize: 56, lineHeight: 58, color: colors.ink },
  per: { fontSize: 16, color: colors.ink3 },
  priceNote: { marginTop: 6, fontSize: 13.5, lineHeight: 19, color: colors.ink3 },
  features: { gap: 14, marginVertical: 24 },
  feature: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  featureText: { flex: 1, fontSize: 15, lineHeight: 21, color: colors.ink },
  freeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  freeText: { flex: 1, fontSize: 13, lineHeight: 18, color: colors.ink3 },
  restore: { alignSelf: 'center', marginTop: 22, paddingVertical: 6 },
  restoreText: { fontSize: 14, fontWeight: '600', color: colors.ink2, textDecorationLine: 'underline' },
  disclosure: { marginTop: 20, fontSize: 11.5, lineHeight: 17, textAlign: 'center', color: colors.ink4 },
  legal: { flexDirection: 'row', justifyContent: 'center', marginTop: 12 },
  legalLink: { fontSize: 12.5, color: colors.ink2, textDecorationLine: 'underline' },
  legalDot: { fontSize: 12.5, color: colors.ink4 },
});
