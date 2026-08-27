/**
 * lib/notifications.ts — Expo push notification registration.
 *
 * Call registerForPushNotifications() after the user is authenticated.
 * It requests permission, gets the Expo push token, and saves it to the
 * profiles table so the server can send notifications.
 *
 * IMPORTANT: No top-level native module calls here. The setNotificationHandler
 * call was previously at module scope and caused a launch crash (SIGABRT on the
 * TurboModule queue) on devices where the push entitlement wasn't ready yet.
 * Everything is now inside the function and wrapped in try/catch.
 */

import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';

export async function registerForPushNotifications(): Promise<void> {
  // Push notifications only work on physical devices
  if (!Device.isDevice) return;

  try {
    // Dynamically import expo-notifications so a missing entitlement or
    // misconfiguration never crashes the app at module load time
    const Notifications = await import('expo-notifications');

    // Configure foreground display — done here, not at module level.
    // shouldShowBanner + shouldShowList replaced shouldShowAlert in
    // expo-notifications 55.0.22; we set both so the handler keeps showing
    // alerts in foreground on older + newer SDKs without warnings.
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    // Android requires a notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'LevlCast',
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    // Request permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return;

    // Get the Expo push token
    const projectId = process.env.EXPO_PUBLIC_PROJECT_ID;
    if (!projectId) return;

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;
    if (!token) return;

    // Save token to the user's profile
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('profiles')
      .update({ expo_push_token: token })
      .eq('id', user.id);
  } catch (err) {
    // Non-fatal — push setup failure should never crash or block the app
    console.warn('[notifications] Push setup failed:', err);
  }
}
