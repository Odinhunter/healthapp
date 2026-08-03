import { useEffect } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import IllustrationTrend from '../../src/components/illustrations/IllustrationTrend';
import PrimaryButton from '../../src/components/PrimaryButton';
import { colors, spacing, typography } from '../../src/constants/theme';

export default function WelcomeScreen() {
  const router = useRouter();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 600 });
    translateY.value = withSpring(0, { damping: 20, stiffness: 100 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <SafeAreaView style={styles.container}>
      {/* Illustration — top 60% */}
      <View style={styles.illustrationArea}>
        <IllustrationTrend />
      </View>

      {/* Content — bottom 40% */}
      <Animated.View style={[styles.content, animatedStyle]}>
        {/* TODO: Replace with final app name */}
        <Text style={styles.wordmark}>HealthApp</Text>

        <Text style={styles.headline}>Your health, completely remembered.</Text>

        <Text style={styles.subtext}>
          Every report. Every visit. Every number. Always there when you need it.
        </Text>

        <View style={styles.buttonWrapper}>
          <PrimaryButton
            label="Get started"
            onPress={() => router.push('/(auth)/onboarding')}
          />
        </View>

        <Pressable
          onPress={() => router.push('/(auth)/login')}
          style={styles.loginLink}
        >
          <Text style={styles.loginLinkText}>I already have an account</Text>
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  illustrationArea: {
    flex: 0.45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 0.55,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
  },
  wordmark: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: -0.5,
    marginBottom: spacing.sm,
  },
  headline: {
    fontSize: typography.xxl,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 36,
    letterSpacing: -0.3,
    textAlign: 'center',
    maxWidth: 300,
  },
  subtext: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 280,
    marginTop: spacing.md,
  },
  buttonWrapper: {
    width: '100%',
    marginTop: spacing.xxxl,
  },
  loginLink: {
    marginTop: spacing.lg,
    padding: spacing.sm,
  },
  loginLinkText: {
    fontSize: typography.base,
    color: colors.primary,
    textAlign: 'center',
  },
});
