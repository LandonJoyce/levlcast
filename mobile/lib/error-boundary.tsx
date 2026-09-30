/**
 * lib/error-boundary.tsx — Global React error boundary.
 *
 * Catches any unhandled React render error and shows a recovery screen
 * instead of a white screen of death. The user can tap "Try again" to
 * remount the entire component tree.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from './theme';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>{this.state.error?.message || 'An unexpected error occurred.'}</Text>
          <Pressable style={styles.button} onPress={this.handleReset}>
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

// System fonts here on purpose: this can show before the app's own fonts load.
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink, marginBottom: 12 },
  message: { fontSize: 14, color: colors.ink3, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  button: { backgroundColor: colors.ink, borderRadius: 9, paddingHorizontal: 26, paddingVertical: 13 },
  buttonText: { color: colors.bg, fontSize: 15, fontWeight: '700' },
});
