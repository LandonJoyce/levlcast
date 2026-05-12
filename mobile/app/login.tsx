import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Platform, Linking,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/colors';

WebBrowser.maybeCompleteAuthSession();

const REDIRECT_URL = 'levlcast://auth/callback';

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleTwitchLogin() {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'twitch',
        options: {
          redirectTo: REDIRECT_URL,
          scopes: 'user:read:email user:read:follows',
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (!data.url) throw new Error('No auth URL returned');

      const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URL);

      if (result.type === 'success' && result.url) {
        // Parse code from custom scheme URL manually (URL constructor may not
        // handle custom schemes on all RN versions)
        const match = result.url.match(/[?&]code=([^&]+)/);
        const code = match?.[1];
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          router.replace('/(tabs)/dashboard');
        } else {
          throw new Error('No code in callback URL');
        }
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        // User closed the browser — not an error
      }
    } catch (e: any) {
      Alert.alert('Login failed', e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAppleLogin() {
    setLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (credential.identityToken) {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
        });
        if (error) throw error;
        router.replace('/(tabs)/dashboard');
      }
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Apple Sign In failed', e.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.glow} />

      <View style={styles.content}>
        <Text style={styles.logo}>LevlCast</Text>
        <Text style={styles.tagline}>Your Personal Stream Manager</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome</Text>
          <Text style={styles.cardSub}>Connect your account to get started.</Text>

          {/* Sign in with Apple — required by Apple when other OAuth is present */}
          {Platform.OS === 'ios' && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={12}
              style={styles.appleBtn}
              onPress={handleAppleLogin}
            />
          )}

          <TouchableOpacity
            style={styles.twitchBtn}
            onPress={handleTwitchLogin}
            disabled={loading}
            activeOpacity={0.82}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.twitchBtnText}>Continue with Twitch</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Required App Store disclosures — links must be tappable */}
        <Text style={styles.legal}>
          By continuing you agree to our{' '}
          <Text
            style={styles.legalLink}
            onPress={() => Linking.openURL('https://levlcast.com/terms')}
          >
            Terms of Service
          </Text>
          {' '}and{' '}
          <Text
            style={styles.legalLink}
            onPress={() => Linking.openURL('https://levlcast.com/privacy')}
          >
            Privacy Policy
          </Text>.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  glow: {
    position: 'absolute',
    top: '20%',
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(155,106,255,0.15)',
  },
  content: { width: '100%', maxWidth: 380, alignItems: 'center' },
  logo: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.accentLight,
    marginBottom: 6,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 15,
    color: colors.muted,
    marginBottom: 48,
  },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 28,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  cardSub: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: 24,
    lineHeight: 20,
  },
  appleBtn: {
    width: '100%',
    height: 50,
    marginBottom: 12,
  },
  twitchBtn: {
    backgroundColor: '#9146FF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  twitchBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  legal: {
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
  legalLink: {
    color: colors.accentLight,
  },
});
