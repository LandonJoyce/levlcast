import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { initRevenueCat } from '@/lib/revenuecat';
import { registerForPushNotifications } from '@/lib/notifications';
import { ErrorBoundary } from '@/lib/error-boundary';
import { colors } from '@/lib/colors';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        try { initRevenueCat(session.user.id); } catch {}
        registerForPushNotifications(); // request permission + store token
      }
      setReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        try { initRevenueCat(session.user.id); } catch {}
        registerForPushNotifications(); // re-register on sign-in in case token changed
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!ready) return null;

  return (
    <ErrorBoundary>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="vod/[id]" options={{ title: 'Stream Report', headerBackTitle: 'VODs' }} />
        <Stack.Screen name="subscribe" options={{ title: 'Upgrade to Pro', presentation: 'modal' }} />
      </Stack>
    </ErrorBoundary>
  );
}
