import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getProPackage, purchasePro, restorePurchases } from '@/lib/revenuecat';
import { colors } from '@/lib/colors';
import { PurchasesPackage } from 'react-native-purchases';

const FEATURES = [
  'Unlimited VOD analyses',
  'AI coaching report after every stream',
  'Unlimited clip generation',
  'Growth attribution tracking',
  'Priority processing',
];

export default function SubscribeScreen() {
  const [pkg, setPkg] = useState<PurchasesPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const router = useRouter();

  useEffect(() => {
    getProPackage().then(p => {
      setPkg(p);
      setLoading(false);
    });
  }, []);

  async function handlePurchase() {
    if (!pkg) return;
    setPurchasing(true);
    const success = await purchasePro(pkg);
    setPurchasing(false);
    if (success) {
      Alert.alert('Welcome to Pro!', 'Your subscription is now active.', [
        { text: 'OK', onPress: () => router.back() },
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

  const price = pkg?.product.priceString ?? '$9.99';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Upgrade to Pro</Text>
      <Text style={styles.sub}>Unlock everything LevlCast has to offer.</Text>

      {/* Price card */}
      <View style={styles.priceCard}>
        <Text style={styles.price}>
          {loading ? '...' : price}
          <Text style={styles.pricePer}> / month</Text>
        </Text>
        <Text style={styles.cancelNote}>Cancel anytime in App Store settings</Text>
      </View>

      {/* Features */}
      <View style={styles.featureList}>
        {FEATURES.map(f => (
          <View key={f} style={styles.featureRow}>
            <View style={styles.featureDot} />
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
          <Text style={styles.subscribeBtnText}>Subscribe Now</Text>
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
        {price}/month after any free trial. Payment charged to your Apple ID account at confirmation of purchase. Subscription automatically renews unless auto-renew is turned off at least 24 hours before the end of the current period. Manage subscriptions in your App Store account settings.
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
  title: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.8, marginBottom: 6 },
  sub: { fontSize: 15, color: colors.muted, marginBottom: 28 },
  priceCard: { backgroundColor: 'rgba(124,58,237,0.1)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)', padding: 22, marginBottom: 24 },
  price: { fontSize: 32, fontWeight: '800', color: colors.accentLight },
  pricePer: { fontSize: 16, fontWeight: '400', color: colors.muted },
  cancelNote: { fontSize: 12, color: colors.muted, marginTop: 4 },
  featureList: { marginBottom: 28, gap: 14 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accentLight, flexShrink: 0 },
  featureText: { fontSize: 15, color: colors.text },
  subscribeBtn: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 16 },
  subscribeBtnDisabled: { opacity: 0.5 },
  subscribeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  restoreBtn: { alignItems: 'center', paddingVertical: 12, marginBottom: 24 },
  restoreBtnText: { color: colors.accentLight, fontSize: 14, fontWeight: '600' },
  disclosure: { fontSize: 11, color: colors.muted, lineHeight: 17, textAlign: 'center', marginBottom: 16 },
  legalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  legalLink: { fontSize: 12, color: colors.accentLight },
  legalDot: { color: colors.muted, fontSize: 12 },
});
