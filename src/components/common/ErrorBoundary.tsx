import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../constants/theme';

interface Props {
  children: ReactNode;
  /** Called on every caught error — wire to a crash reporter when one exists. */
  onError?: (error: Error, info: ErrorInfo) => void;
  /**
   * Escape hatch shown as a second action. Resetting in place re-renders the
   * same route, so a deterministic error (a bad row on a report screen) would
   * throw again immediately. This lets the caller navigate away instead.
   */
  onGoHome?: () => void;
}

interface State {
  error: Error | null;
}

/**
 * Catches render errors anywhere below it and shows a recoverable screen
 * instead of a white void.
 *
 * Must be a class — React has no hook equivalent for componentDidCatch.
 *
 * What it does NOT catch (React limitation): errors inside event handlers,
 * async callbacks, or timers. Those still need local try/catch. Most of the
 * app's data fetching already returns { data, error } rather than throwing,
 * so the realistic trigger here is a bad row rendering into a screen —
 * a null value where a component expects a number, an unexpected enum.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep the stack in the dev console; ship it to a reporter later.
    console.error('[ErrorBoundary]', error, info.componentStack);
    this.props.onError?.(error, info);
  }

  reset = () => this.setState({ error: null });

  goHome = () => {
    this.setState({ error: null });
    this.props.onGoHome?.();
  };

  render() {
    const { error } = this.state;
    const { onGoHome } = this.props;
    if (!error) return this.props.children;

    return (
      <View style={s.screen}>
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={s.card}>
            <Text style={s.title}>Something went wrong</Text>
            <Text style={s.body}>
              This screen ran into a problem. Your reports and records are safe —
              nothing was lost.
            </Text>

            <Pressable
              onPress={this.reset}
              style={({ pressed }) => [s.button, pressed && s.buttonPressed]}
              accessibilityRole="button"
              accessibilityLabel="Try again"
            >
              <Text style={s.buttonText}>Try again</Text>
            </Pressable>

            {onGoHome && (
              <Pressable
                onPress={this.goHome}
                style={({ pressed }) => [s.buttonGhost, pressed && s.buttonPressed]}
                accessibilityRole="button"
                accessibilityLabel="Back to home"
              >
                <Text style={s.buttonGhostText}>Back to home</Text>
              </Pressable>
            )}

            {__DEV__ && (
              <View style={s.debug}>
                <Text style={s.debugLabel}>DEV ONLY</Text>
                <Text style={s.debugText}>
                  {error.name}: {error.message}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 28,
    alignItems: 'center',
  },
  title: {
    fontSize: typography.lg,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  body: {
    fontSize: typography.base,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  button: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: colors.surface,
    fontSize: typography.base,
    fontWeight: '600',
  },
  buttonGhost: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buttonGhostText: {
    color: colors.textSecondary,
    fontSize: typography.base,
    fontWeight: '600',
  },
  debug: {
    width: '100%',
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  debugLabel: {
    fontSize: typography.xs,
    fontWeight: '600',
    letterSpacing: 1,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  debugText: {
    fontSize: typography.sm,
    lineHeight: 19,
    color: colors.danger,
  },
});
