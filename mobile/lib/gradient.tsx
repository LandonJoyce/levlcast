/**
 * Brand gradient helpers — mirrors the web's
 *   linear-gradient(135deg, rgb(148,61,255) 0%, rgb(242,97,121) 100%)
 * used on CTAs, the score hero, and PRO badges. Wrapped here so call
 * sites don't have to repeat the angle/color math.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, StyleProp, StyleSheet, Text, TextStyle, TouchableOpacity, View, ViewStyle } from 'react-native';

export const BRAND_COLORS = ['rgb(148,61,255)', 'rgb(242,97,121)'] as const;
// 135deg in CSS = top-left → bottom-right. Translated to RN start/end coords.
export const BRAND_START = { x: 0, y: 0 };
export const BRAND_END = { x: 1, y: 1 };

interface GradButtonProps {
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  children: React.ReactNode;
}

/** Primary CTA filled with the brand gradient. White text on top. */
export function GradButton({ onPress, disabled, loading, style, textStyle, children }: GradButtonProps) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled || loading} activeOpacity={0.85} style={[styles.wrap, disabled && { opacity: 0.5 }, style]}>
      <LinearGradient colors={BRAND_COLORS as unknown as [string, string]} start={BRAND_START} end={BRAND_END} style={styles.fill}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={[styles.text, textStyle]}>{children}</Text>
        }
      </LinearGradient>
    </TouchableOpacity>
  );
}

/** Thin gradient bar — used for PRO badges and small accents. */
export function GradBadge({ children, style, textStyle }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; textStyle?: StyleProp<TextStyle> }) {
  return (
    <View style={[styles.badgeWrap, style]}>
      <LinearGradient colors={BRAND_COLORS as unknown as [string, string]} start={BRAND_START} end={BRAND_END} style={styles.badgeFill}>
        <Text style={[styles.badgeText, textStyle]}>{children}</Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 12, overflow: 'hidden' },
  fill: { paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  badgeWrap: { borderRadius: 999, overflow: 'hidden' },
  badgeFill: { paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
});
