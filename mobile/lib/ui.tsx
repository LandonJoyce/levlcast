import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from './theme';

/** "#RRGGBB" at an opacity, for tints and pill borders. */
export function alpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** A scrolling page. Tab pages have no header, so they clear the status bar themselves. */
export function Screen({
  children,
  refreshing,
  onRefresh,
  inset = true,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Leave room for the status bar (pages without a navigation header). */
  inset?: boolean;
}) {
  const insets = useSafeAreaInsets();
  // The scroll area starts under the status bar, so text never scrolls up
  // behind the clock and the pull-to-refresh spinner stays visible.
  return (
    <View style={[s.screen, { paddingTop: inset ? insets.top : 0 }]}>
      <ScrollView
        style={s.screen}
        contentContainerStyle={[s.screenIn, { paddingTop: 18 }]}
        refreshControl={
          onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.ink3} /> : undefined
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </View>
  );
}

export function Center({ children }: { children: ReactNode }) {
  return <View style={s.center}>{children}</View>;
}

export function Loading() {
  return (
    <Center>
      <ActivityIndicator color={colors.ink3} />
    </Center>
  );
}

export function PageTitle({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.pageTitle, style]}>{children}</Text>;
}

/** Small uppercase label, the site's `.hm-k`. */
export function Label({ children, color, style }: { children: ReactNode; color?: string; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.label, color ? { color } : null, style]}>{children}</Text>;
}

/** A label with something on the right: "Result ········ Score 52". */
export function LabelRow({ left, right, style }: { left: ReactNode; right?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.labelRow, style]}>
      <View style={s.labelRowLeft}>{typeof left === 'string' ? <Label>{left}</Label> : left}</View>
      {right !== undefined && right !== null ? typeof right === 'string' ? <Label>{right}</Label> : right : null}
    </View>
  );
}

export function SectionHead({ title, meta, action, onAction }: { title: string; meta?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={s.sectionHead}>
      <Text style={s.sectionTitle}>{title}</Text>
      {meta ? <Text style={s.sectionMeta} numberOfLines={1}>{meta}</Text> : null}
      <View style={{ flex: 1 }} />
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={10}>
          <Text style={s.sectionAction}>{action} {'→'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Hairline({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[s.hairline, style]} />;
}

type ButtonKind = 'primary' | 'ghost' | 'danger';

/** Flat buttons: white with dark text, or a hairline outline. Never a gradient. */
export function Button({
  title,
  onPress,
  kind = 'primary',
  small,
  loading,
  disabled,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  kind?: ButtonKind;
  small?: boolean;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const textColor = kind === 'primary' ? colors.bg : kind === 'danger' ? colors.danger : colors.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.btn,
        small && s.btnSmall,
        kind === 'primary' ? s.btnPrimary : kind === 'danger' ? s.btnDanger : s.btnGhost,
        disabled && !loading && { opacity: 0.4 },
        pressed && { opacity: 0.75 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <>
          {icon}
          <Text style={[s.btnText, small && s.btnTextSmall, { color: textColor }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

/** A small outlined pill: "Called it", "Promoted", "Sealed". */
export function Tag({ text, color = colors.ink2, style }: { text: string; color?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.tag, { borderColor: color.startsWith('#') ? alpha(color, 0.45) : colors.line2 }, style]}>
      <Text style={[s.tagText, { color }]}>{text}</Text>
    </View>
  );
}

export function Bar({
  fraction,
  color = colors.ink,
  height = 6,
  style,
}: {
  fraction: number;
  color?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  return (
    <View style={[{ height, borderRadius: height / 2, backgroundColor: colors.track, overflow: 'hidden' }, style]}>
      <View style={{ width: `${pct}%`, height: '100%', borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

/** A plain note with a rule on its left, the site's `.au-note`. */
export function Note({ children, tone }: { children: ReactNode; tone?: 'bad' | 'warn' }) {
  const c = tone === 'bad' ? colors.danger : tone === 'warn' ? colors.warn : colors.line2;
  return (
    <View style={[s.note, { borderLeftColor: c }]}>
      {typeof children === 'string' ? <Text style={s.noteText}>{children}</Text> : children}
    </View>
  );
}

export const typo = StyleSheet.create({
  body: { fontSize: 15, lineHeight: 22, color: colors.ink2 },
  small: { fontSize: 13, lineHeight: 19, color: colors.ink3 },
  strong: { fontSize: 15, fontWeight: '600', color: colors.ink },
  display: { fontFamily: fonts.display, fontSize: 20, lineHeight: 27, letterSpacing: -0.3, color: colors.ink },
  mono: { fontFamily: fonts.mono, fontSize: 12, color: colors.ink3 },
  numbers: { fontFamily: fonts.numbers, color: colors.ink },
});

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenIn: { paddingHorizontal: 20, paddingBottom: 56 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: 32 },
  pageTitle: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38, letterSpacing: -0.9, color: colors.ink },
  label: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.ink4 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
  labelRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', gap: 12, marginBottom: 12 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 20, letterSpacing: -0.4, color: colors.ink },
  sectionMeta: { fontFamily: fonts.mono, fontSize: 10.5, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.ink4, flexShrink: 1 },
  sectionAction: { fontSize: 13, fontWeight: '600', color: colors.ink2 },
  hairline: { height: 1, backgroundColor: colors.line },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 46,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 9,
    borderWidth: 1,
  },
  btnSmall: { minHeight: 34, paddingHorizontal: 13, paddingVertical: 7 },
  btnPrimary: { backgroundColor: colors.ink, borderColor: colors.ink },
  btnGhost: { backgroundColor: 'transparent', borderColor: colors.line2 },
  btnDanger: { backgroundColor: 'transparent', borderColor: alpha(colors.danger, 0.4) },
  btnText: { fontSize: 15, fontWeight: '700' },
  btnTextSmall: { fontSize: 13, fontWeight: '600' },
  tag: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { fontFamily: fonts.mono, fontSize: 9.5, letterSpacing: 1.1, textTransform: 'uppercase' },
  note: { borderLeftWidth: 2, paddingLeft: 12, paddingVertical: 2 },
  noteText: { fontSize: 14, lineHeight: 21, color: colors.ink3 },
});
