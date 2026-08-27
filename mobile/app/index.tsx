import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/colors';

export default function Index() {
  const router = useRouter();
  const [error, setError] = useState(false);

  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    setError(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.replace('/(tabs)/dashboard');
      } else {
        router.replace('/login');
      }
    } catch {
      setError(true);
    }
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorTitle}>Connection issue</Text>
        <Text style={styles.errorText}>Couldn't reach LevlCast. Check your internet and try again.</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={checkSession}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.accentLight} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8 },
  errorText: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  retryBtn: { backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 12 },
  retryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
