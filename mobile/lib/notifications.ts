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
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

export async function registerForPushNotifications(): Promise<void> {
  // Push notifications only work on physical devices
  if (!Device.isDevice || Platform.OS === 'web') return;

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

    // Get the Expo push token. The project id is in app.json too, so a build
    // without the env var still registers.
    const projectId =
      process.env.EXPO_PUBLIC_PROJECT_ID ?? (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
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

export type PushData = { vodId?: string; screen?: string; type?: string };

/**
 * Calls `onOpen` with a notification's data when the streamer taps it,
 * including the tap that launched the app. "Your result is in" and "Your
 * clip is ready" carry the stream's vodId. Same rules as above: loaded
 * lazily, and a failure only means taps open the app where it was.
 */
export async function listenForNotificationTaps(onOpen: (data: PushData) => void): Promise<() => void> {
  if (Platform.OS === 'web') return () => {};
  try {
    const Notifications = await import('expo-notifications');
    const seen = new Set<string>();
    const handle = (response: { notification: { request: { identifier: string; content: { data?: unknown } } } } | null) => {
      if (!response) return;
      const id = response.notification.request.identifier;
      if (seen.has(id)) return;
      seen.add(id);
      const data = (response.notification.request.content.data ?? {}) as PushData;
      onOpen(data);
    };
    const last = await Notifications.getLastNotificationResponseAsync();
    handle(last as never);
    const sub = Notifications.addNotificationResponseReceivedListener((r) => handle(r as never));
    return () => sub.remove();
  } catch (err) {
    console.warn('[notifications] Tap handling unavailable:', err);
    return () => {};
  }
}
