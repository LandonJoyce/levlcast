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

export async function getProPackage(): Promise<PurchasesPackage | null> {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current?.monthly ?? null;
  } catch {
    return null;
  }
}

export async function getAnnualPackage(): Promise<PurchasesPackage | null> {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current?.annual ?? null;
  } catch {
    return null;
  }
}

export async function purchasePro(pkg: PurchasesPackage): Promise<boolean> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo.entitlements.active['pro'] !== undefined;
  } catch {
    return false;
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
