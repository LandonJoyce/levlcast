import { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { supabase } from '@/lib/supabase';
import { initRevenueCat } from '@/lib/revenuecat';
import { listenForNotificationTaps, registerForPushNotifications } from '@/lib/notifications';
import { ErrorBoundary } from '@/lib/error-boundary';
import { colors, fonts } from '@/lib/theme';

export default function RootLayout() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    [fonts.display]: require('../assets/fonts/PlusJakartaSans-ExtraBold.ttf'),
    [fonts.numbers]: require('../assets/fonts/BigShoulders-Black.ttf'),
    [fonts.mono]: require('../assets/fonts/GeistMono-Medium.ttf'),
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        try { initRevenueCat(session.user.id); } catch {}
        registerForPushNotifications(); // request permission + store token
      }
      setReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        try { initRevenueCat(session.user.id); } catch {}
        registerForPushNotifications(); // re-register on sign-in in case token changed
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // A tapped notification opens what it's about: "Your result is in" and
  // "Your clip is ready" go to that stream. Waits a beat on launch so the
  // sign-in check has put the tabs underneath first.
  useEffect(() => {
    if (!ready) return;
    let stop = () => {};
    let alive = true;
    listenForNotificationTaps((data) => {
      setTimeout(() => {
        try {
          if (data.vodId) router.push(`/vod/${data.vodId}`);
          else if (data.screen === 'vods') router.push('/(tabs)/vods');
        } catch {}
      }, 700);
    }).then((unsub) => {
      if (alive) stop = unsub;
      else unsub();
    });
    return () => {
      alive = false;
      stop();
    };
  }, [ready, router]);

  // Fonts come from the app bundle, so this is a moment; if they ever
  // fail, the app carries on in the system font.
  if (!ready || (!fontsLoaded && !fontError)) return null;

  return (
    <ErrorBoundary>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.ink,
          headerTitleStyle: { color: colors.ink, fontWeight: '600', fontSize: 16 },
          headerShadowVisible: false,
          headerBackTitle: 'Back',
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="vod/[id]" options={{ title: 'Stream' }} />
        <Stack.Screen name="clip/[id]" options={{ title: 'Clip' }} />
        <Stack.Screen name="subscribe" options={{ title: 'LevlCast Pro', presentation: 'modal' }} />
      </Stack>
    </ErrorBoundary>
  );
}
