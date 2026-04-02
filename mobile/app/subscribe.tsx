import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getProPackage, getAnnualPackage, purchasePro, restorePurchases } from '@/lib/revenuecat';
import { colors } from '@/lib/colors';
import { PurchasesPackage } from 'react-native-purchases';

const FEATURES = [
  '10 VOD analyses per month',
  'AI coaching report after every stream',
  'Unlimited clip generation',
  'Growth attribution tracking',
  'Priority processing',
];

export default function SubscribeScreen() {
  const [monthlyPkg, setMonthlyPkg] = useState<PurchasesPackage | null>(null);
  const [annualPkg, setAnnualPkg] = useState<PurchasesPackage | null>(null);
  const [selected, setSelected] = useState<'monthly' | 'annual'>('annual');
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const router = useRouter();

  useEffect(() => {
    Promise.all([getProPackage(), getAnnualPackage()]).then(([monthly, annual]) => {
      setMonthlyPkg(monthly);
      setAnnualPkg(annual);
      setLoading(false);
    });
  }, []);

  const activePkg = selected === 'annual' ? annualPkg : monthlyPkg;

  async function handlePurchase() {
    if (!activePkg) return;
    setPurchasing(true);
    const success = await purchasePro(activePkg);
    setPurchasing(false);
    if (success) {
      Alert.alert('Welcome to Pro!', 'Your subscription is now active.', [
        { text: 'Lets go', onPress: () => router.back() },
      ]);
    }
  }

  async function handleRestore() {
    setRestoring(true);
    const success = await restorePurchases();
    setRestoring(false);
    if (success) {
      Alert.alert('Restored', 'Your Pro subscription is active.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } else {
      Alert.alert('Nothing to restore', 'No active subscription found.');
    }
  }

  const monthlyPrice = monthlyPkg?.product.priceString ?? '$9.99';
  const annualPrice = annualPkg?.product.priceString ?? null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Founding member badge */}
      <View style={styles.foundingBadge}>
        <Text style={styles.foundingBadgeText}>Founding Member Price — Limited Time</Text>
      </View>

      <Text style={styles.title}>Upgrade to Pro</Text>
      <Text style={styles.sub}>The only tool that tells you why your stream did or did not work.</Text>

      {/* Plan toggle */}
      <View style={styles.toggle}>
        <TouchableOpacity
          style={[styles.toggleOption, selected === 'monthly' && styles.toggleOptionActive]}
          onPress={() => setSelected('monthly')}
        >
          <Text style={[styles.toggleText, selected === 'monthly' && styles.toggleTextActive]}>Monthly</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleOption, selected === 'annual' && styles.toggleOptionActive]}
          onPress={() => setSelected('annual')}
        >
          <Text style={[styles.toggleText, selected === 'annual' && styles.toggleTextActive]}>Annual</Text>
          <View style={styles.saveBadge}>
            <Text style={styles.saveBadgeText}>2 months free</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Price card */}
      <View style={styles.priceCard}>
        {loading ? (
          <ActivityIndicator color={colors.accentLight} />
        ) : selected === 'monthly' ? (
          <>
            <Text style={styles.price}>{monthlyPrice}<Text style={styles.pricePer}> / month</Text></Text>
            <Text style={styles.cancelNote}>Founding member rate. Cancel anytime.</Text>
          </>
        ) : annualPrice ? (
          <>
            <Text style={styles.price}>{annualPrice}<Text style={styles.pricePer}> / year</Text></Text>
            <Text style={styles.cancelNote}>Billed annually. Cancel anytime in App Store settings.</Text>
          </>
        ) : (
          <>
            <Text style={styles.price}>{monthlyPrice}<Text style={styles.pricePer}> / month</Text></Text>
            <Text style={styles.cancelNote}>Founding member rate. Cancel anytime.</Text>
          </>
        )}
      </View>

      {/* Features */}
      <View style={styles.featureList}>
        {FEATURES.map(f => (
          <View key={f} style={styles.featureRow}>
            <Text style={styles.featureCheck}>✓</Text>
            <Text style={styles.featureText}>{f}</Text>
          </View>
        ))}
      </View>

      {/* Subscribe button */}
      <TouchableOpacity
        style={[styles.subscribeBtn, (loading || purchasing) && styles.subscribeBtnDisabled]}
        onPress={handlePurchase}
        disabled={loading || purchasing}
        activeOpacity={0.85}
      >
        {purchasing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.subscribeBtnText}>
            {selected === 'annual' ? 'Get Pro — Best Value' : 'Get Pro'}
          </Text>
        )}
      </TouchableOpacity>

      {/* Required: Restore Purchases */}
      <TouchableOpacity style={styles.restoreBtn} onPress={handleRestore} disabled={restoring}>
        {restoring ? (
          <ActivityIndicator color={colors.accentLight} size="small" />
        ) : (
          <Text style={styles.restoreBtnText}>Restore Purchases</Text>
        )}
      </TouchableOpacity>

      {/* Required: Subscription disclosure */}
      <Text style={styles.disclosure}>
        {selected === 'annual' && annualPrice
          ? `${annualPrice}/year`
          : `${monthlyPrice}/month`} after any free trial. Payment charged to your Apple ID account at confirmation of purchase. Subscription automatically renews unless auto-renew is turned off at least 24 hours before the end of the current period. Manage subscriptions in your App Store account settings.
      </Text>

      {/* Required: ToS and Privacy links */}
      <View style={styles.legalRow}>
        <TouchableOpacity onPress={() => Linking.openURL('https://levlcast.com/terms')}>
          <Text style={styles.legalLink}>Terms of Service</Text>
        </TouchableOpacity>
        <Text style={styles.legalDot}> · </Text>
        <TouchableOpacity onPress={() => Linking.openURL('https://levlcast.com/privacy')}>
          <Text style={styles.legalLink}>Privacy Policy</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 24, paddingBottom: 60 },

  // Founding badge
  foundingBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(124,58,237,0.15)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.35)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 16 },
  foundingBadgeText: { fontSize: 11, fontWeight: '700', color: colors.accentLight, letterSpacing: 0.3 },

  title: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.8, marginBottom: 6 },
  sub: { fontSize: 14, color: colors.muted, marginBottom: 24, lineHeight: 20 },

  // Toggle
  toggle: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 4, marginBottom: 16 },
  toggleOption: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  toggleOptionActive: { backgroundColor: colors.accent },
  toggleText: { fontSize: 14, fontWeight: '600', color: colors.muted },
  toggleTextActive: { color: '#fff' },
  saveBadge: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  saveBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  // Price card
  priceCard: { backgroundColor: 'rgba(124,58,237,0.1)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)', padding: 22, marginBottom: 24, minHeight: 72, justifyContent: 'center' },
  price: { fontSize: 32, fontWeight: '800', color: colors.accentLight },
  pricePer: { fontSize: 16, fontWeight: '400', color: colors.muted },
  cancelNote: { fontSize: 12, color: colors.muted, marginTop: 4 },

  // Features
  featureList: { marginBottom: 28, gap: 14 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureCheck: { fontSize: 14, fontWeight: '800', color: colors.accentLight, width: 16 },
  featureText: { fontSize: 15, color: colors.text, flex: 1 },

  // Buttons
  subscribeBtn: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 16 },
  subscribeBtnDisabled: { opacity: 0.5 },
  subscribeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  restoreBtn: { alignItems: 'center', paddingVertical: 12, marginBottom: 24 },
  restoreBtnText: { color: colors.accentLight, fontSize: 14, fontWeight: '600' },

  // Legal
  disclosure: { fontSize: 11, color: colors.muted, lineHeight: 17, textAlign: 'center', marginBottom: 16 },
  legalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  legalLink: { fontSize: 12, color: colors.accentLight },
  legalDot: { color: colors.muted, fontSize: 12 },
});
