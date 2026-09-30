import Purchases, { LOG_LEVEL, PurchasesPackage } from 'react-native-purchases';
import { Platform } from 'react-native';

const RC_APPLE_KEY = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY!;
const RC_GOOGLE_KEY = process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY!;

export function initRevenueCat(userId?: string) {
  try {
    Purchases.setLogLevel(LOG_LEVEL.ERROR);
    if (Platform.OS === 'ios') {
      Purchases.configure({ apiKey: RC_APPLE_KEY, appUserID: userId });
    } else {
      Purchases.configure({ apiKey: RC_GOOGLE_KEY, appUserID: userId });
    }
  } catch (err) {
    console.warn('[revenuecat] Init failed:', err);
  }
}

/**
 * Pro's monthly and yearly packages from the current offering. Prices come
 * from the App Store in the buyer's own currency, so the app never shows a
 * price it made up.
 */
export async function getProPackages(): Promise<{ monthly: PurchasesPackage | null; annual: PurchasesPackage | null }> {
  try {
    const offerings = await Purchases.getOfferings();
    return { monthly: offerings.current?.monthly ?? null, annual: offerings.current?.annual ?? null };
  } catch {
    return { monthly: null, annual: null };
  }
}

export type PurchaseResult = { ok: true } | { ok: false; cancelled: boolean; message: string | null };

export async function purchasePro(pkg: PurchasesPackage): Promise<PurchaseResult> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    if (customerInfo.entitlements.active['pro'] !== undefined) return { ok: true };
    return { ok: false, cancelled: false, message: "The purchase went through but Pro isn't showing yet. Try Restore purchases in a minute." };
  } catch (err: any) {
    if (err?.userCancelled) return { ok: false, cancelled: true, message: null };
    return { ok: false, cancelled: false, message: typeof err?.message === 'string' ? err.message : null };
  }
}

export async function restorePurchases(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return customerInfo.entitlements.active['pro'] !== undefined;
  } catch {
    return false;
  }
}

export async function getCustomerInfo() {
  try {
    return await Purchases.getCustomerInfo();
  } catch {
    return null;
  }
}
