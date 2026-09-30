import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';
import { Label } from '@/lib/ui';

WebBrowser.maybeCompleteAuthSession();

const REDIRECT_URL = 'levlcast://auth/callback';

function TwitchGlyph() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        fill="#9146FF"
        d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"
      />
    </Svg>
  );
}

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();

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
          const { data: exchanged, error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;

          // Send the Twitch provider tokens to our server so they can be
          // saved on the profile row. Without this, mobile signups end up
          // with NULL twitch_access_token / twitch_refresh_token because
          // the tokens only exist on-device for an instant after exchange.
          // The server's app-token fallback works for most channels, but
          // user-bound tokens are required to see age-gated (18+) VODs.
          const providerToken = exchanged?.session?.provider_token;
          const providerRefreshToken = exchanged?.session?.provider_refresh_token;
          const sessionAccessToken = exchanged?.session?.access_token;
          if ((providerToken || providerRefreshToken) && sessionAccessToken) {
            try {
              await fetch(`${process.env.EXPO_PUBLIC_APP_URL}/api/auth/mobile-link`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${sessionAccessToken}`,
                },
                body: JSON.stringify({
                  provider_token: providerToken,
                  provider_refresh_token: providerRefreshToken,
                }),
              });
            } catch (linkErr) {
              // Non-fatal — login still succeeds, sync will fall back to app token
              console.warn('mobile-link failed:', linkErr);
            }
          }

          router.replace('/(tabs)/dashboard');
        } else {
          throw new Error('No code in callback URL');
        }
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        // User closed the browser — not an error
      }
    } catch (e: any) {
      Alert.alert("Couldn't sign in", e?.message || 'Try again in a minute.');
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
        Alert.alert('Apple sign-in failed', e.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[s.page, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
      <Text style={s.mark}>LevlCast</Text>

      <View style={s.main}>
        <Label>Account</Label>
        <Text style={s.h1}>Sign in with Twitch</Text>
        <Text style={s.sub}>Your LevlCast account is your Twitch account, so there&apos;s no password to make or forget.</Text>

        <Pressable onPress={handleTwitchLogin} disabled={loading} style={({ pressed }) => [s.twitch, (pressed || loading) && { opacity: 0.8 }]}>
          {loading ? (
            <ActivityIndicator color={colors.bg} />
          ) : (
            <>
              <TwitchGlyph />
              <Text style={s.twitchText}>Continue with Twitch</Text>
            </>
          )}
        </Pressable>

        {/* Required by Apple whenever another sign-in is offered. */}
        {Platform.OS === 'ios' && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE}
            cornerRadius={9}
            style={s.apple}
            onPress={handleAppleLogin}
          />
        )}

        <Text style={s.perm}>
          Twitch only shares your username, profile picture and email with us. LevlCast can&apos;t post, chat or change anything on your channel.
        </Text>

        <View style={s.next}>
          <Label style={{ marginBottom: 12 }}>First time here?</Label>
          {[
            ['01', 'Twitch asks if LevlCast can see your account.', "Say yes and you're in."],
            ['02', 'Your past broadcasts show up.', 'If the list is empty, Store past broadcasts is probably off in your Twitch settings.'],
            ['03', 'We start your first report right away.', "It's usually ready in about ten minutes, and it places you on the ladder."],
          ].map(([n, b, rest]) => (
            <View key={n} style={s.step}>
              <Text style={s.stepN}>{n}</Text>
              <Text style={s.stepText}>
                <Text style={{ color: colors.ink, fontWeight: '600' }}>{b}</Text> {rest}
              </Text>
            </View>
          ))}
          <Text style={s.free}>Free is a report every week and 6 clips a month. Each free report coaches the first 2 hours of a stream.</Text>
        </View>
      </View>

      <Text style={s.terms}>
        By continuing you agree to the{' '}
        <Text style={s.termsLink} onPress={() => Linking.openURL('https://levlcast.com/terms')}>
          Terms
        </Text>{' '}
        and the{' '}
        <Text style={s.termsLink} onPress={() => Linking.openURL('https://levlcast.com/privacy')}>
          Privacy Policy
        </Text>
        .
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 22 },
  mark: { fontFamily: fonts.display, fontSize: 20, letterSpacing: -0.5, color: colors.ink },
  main: { flex: 1, justifyContent: 'center', maxWidth: 440, width: '100%', alignSelf: 'center' },
  h1: { marginTop: 10, fontFamily: fonts.display, fontSize: 32, lineHeight: 38, letterSpacing: -0.9, color: colors.ink },
  sub: { marginTop: 10, marginBottom: 26, fontSize: 15.5, lineHeight: 23, color: colors.ink3 },
  twitch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 52,
    borderRadius: 9,
    backgroundColor: colors.ink,
  },
  twitchText: { fontSize: 16, fontWeight: '700', color: colors.bg },
  apple: { width: '100%', height: 52, marginTop: 12 },
  perm: { marginTop: 16, fontSize: 13, lineHeight: 19, color: colors.ink4 },
  next: { marginTop: 30, paddingTop: 22, borderTopWidth: 1, borderTopColor: colors.line },
  step: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  stepN: { width: 22, fontFamily: fonts.mono, fontSize: 12, lineHeight: 20, color: colors.ink4 },
  stepText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.ink3 },
  free: { marginTop: 6, fontSize: 13, lineHeight: 19, color: colors.ink3 },
  terms: { fontSize: 12, lineHeight: 18, textAlign: 'center', color: colors.ink4 },
  termsLink: { color: colors.ink2, textDecorationLine: 'underline' },
});
