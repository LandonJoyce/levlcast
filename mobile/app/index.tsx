import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';
import { Button } from '@/lib/ui';

export default function Index() {
  const router = useRouter();
  const [error, setError] = useState(false);

  useEffect(() => {
    checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkSession() {
    setError(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      router.replace(session ? '/(tabs)/dashboard' : '/login');
    } catch {
      setError(true);
    }
  }

  if (error) {
    return (
      <View style={s.page}>
        <Text style={s.title}>Can&apos;t reach LevlCast</Text>
        <Text style={s.text}>Check your connection and try again.</Text>
        <Button title="Try again" onPress={checkSession} />
      </View>
    );
  }

  return (
    <View style={s.page}>
      <ActivityIndicator color={colors.ink3} />
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, marginBottom: 8 },
  text: { fontSize: 15, lineHeight: 22, color: colors.ink3, textAlign: 'center', marginBottom: 22 },
});
