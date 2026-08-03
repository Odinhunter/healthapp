import { useEffect, useState } from 'react';
import {
  Dimensions,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import IllustrationOrbs from '../../src/components/illustrations/IllustrationOrbs';
import IllustrationPulse from '../../src/components/illustrations/IllustrationPulse';
import IllustrationScattered from '../../src/components/illustrations/IllustrationScattered';
import IllustrationShield from '../../src/components/illustrations/IllustrationShield';
import IllustrationTrend from '../../src/components/illustrations/IllustrationTrend';
import OptionCard from '../../src/components/onboarding/OptionCard';
import ProgressBar from '../../src/components/onboarding/ProgressBar';
import PrimaryButton from '../../src/components/PrimaryButton';
import { colors, spacing, typography } from '../../src/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOTAL_STEPS = 5;

interface OnboardingAnswers {
  records_location: string | null;
  test_frequency: string | null;
  top_priority: string | null;
}

const STEP1_OPTIONS = [
  { label: 'Scattered across WhatsApp', value: 'whatsapp' },
  { label: 'Buried in a folder somewhere', value: 'folder' },
  { label: 'At the lab, nowhere else', value: 'lab_only' },
  { label: "Honestly, I don't track them", value: 'dont_track' },
];

const STEP2_OPTIONS = [
  { label: 'Every few months', value: 'few_months' },
  { label: 'Once a year or so', value: 'once_year' },
  { label: 'Whenever something feels off', value: 'when_needed' },
  { label: "It's been a while, honestly", value: 'been_a_while' },
];

const STEP4_OPTIONS = [
  { label: 'Understanding my own reports', value: 'understanding_reports' },
  { label: 'Keeping track for my parents', value: 'tracking_family' },
  { label: 'Staying on top of medications', value: 'medications' },
  { label: 'Having everything in one place', value: 'one_place' },
];

const TRUST_POINTS = [
  'Stored securely in India, never shared',
  'No ads, no data selling, ever',
  'Delete everything, anytime, instantly',
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [answers, setAnswers] = useState<OnboardingAnswers>({
    records_location: null,
    test_frequency: null,
    top_priority: null,
  });
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const slideX = useSharedValue(0);

  // Slide in whenever step changes
  useEffect(() => {
    slideX.value = withTiming(0, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });
  }, [currentStep]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideX.value }],
  }));

  const goNext = () => {
    slideX.value = SCREEN_WIDTH; // Start offscreen right
    if (currentStep === 1) {
      setAnswers((prev) => ({ ...prev, records_location: selectedOption }));
    } else if (currentStep === 2) {
      setAnswers((prev) => ({ ...prev, test_frequency: selectedOption }));
    } else if (currentStep === 4) {
      setAnswers((prev) => ({ ...prev, top_priority: selectedOption }));
    }
    setSelectedOption(null);
    setCurrentStep((s) => s + 1);
  };

  const goBack = () => {
    if (currentStep === 1) {
      router.back();
      return;
    }
    slideX.value = -SCREEN_WIDTH; // Start offscreen left
    setSelectedOption(null);
    setCurrentStep((s) => s - 1);
  };

  const handleFinish = async () => {
    const answersToSave = {
      ...answers,
      top_priority: selectedOption ?? answers.top_priority,
      onboarding_completed_at: new Date().toISOString(),
    };
    try {
      await AsyncStorage.setItem('onboarding_answers', JSON.stringify(answersToSave));
    } catch {
      // Non-fatal — answers will just be missing from profile
    }
    router.push('/(auth)/login');
  };

  const isContinueEnabled = (): boolean => {
    if (currentStep === 3 || currentStep === 5) return true;
    return selectedOption !== null;
  };

  const renderIllustration = () => {
    switch (currentStep) {
      case 1: return <IllustrationScattered />;
      case 2: return <IllustrationPulse />;
      case 3: return <IllustrationTrend />;
      case 4: return <IllustrationOrbs />;
      case 5: return <IllustrationShield />;
    }
  };

  const renderOptions = () => {
    let options: { label: string; value: string }[] = [];
    if (currentStep === 1) options = STEP1_OPTIONS;
    else if (currentStep === 2) options = STEP2_OPTIONS;
    else if (currentStep === 4) options = STEP4_OPTIONS;
    else return null;

    return (
      <View style={styles.optionsContainer}>
        {options.map((opt) => (
          <OptionCard
            key={opt.value}
            label={opt.label}
            value={opt.value}
            isSelected={selectedOption === opt.value}
            onSelect={() => setSelectedOption(opt.value)}
          />
        ))}
      </View>
    );
  };

  const getHeadline = () => {
    switch (currentStep) {
      case 1: return 'Where do your health records live right now?';
      case 2: return 'How often do you or your family get blood tests done?';
      case 3: return 'Most people lose track of over 80% of their health data within a year.';
      case 4: return 'What matters most to you right now?';
      case 5: return 'Your data belongs to you. Always.';
      default: return '';
    }
  };

  const getSub = () => {
    switch (currentStep) {
      case 1: return 'No judgment — this is exactly why you\'re here.';
      case 2: return 'Knowing this helps us remind you at the right time.';
      case 3: return 'HealthApp remembers everything — every test, every visit, every number — so you never have to search again.'; // TODO: Replace with final app name
      case 4: return 'We\'ll make sure this is front and centre for you.';
      default: return null;
    }
  };

  const getButtonLabel = () => {
    if (currentStep === 3) return 'That\'s exactly what I need';
    if (currentStep === 5) return 'Continue';
    return 'Continue';
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Progress bar — very top */}
      <ProgressBar currentStep={currentStep} totalSteps={TOTAL_STEPS} />

      {/* Back button */}
      <View style={styles.header}>
        <Pressable onPress={goBack} style={styles.backButton} hitSlop={8}>
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.stepContent, animatedStyle]}>
          {/* Illustration */}
          <View style={styles.illustrationArea}>{renderIllustration()}</View>

          {/* Text */}
          <Text style={styles.headline}>{getHeadline()}</Text>
          {getSub() && (
            <Text style={styles.sub}>{getSub()}</Text>
          )}

          {/* Trust bullets — step 5 only */}
          {currentStep === 5 && (
            <View style={styles.trustList}>
              {TRUST_POINTS.map((point, i) => (
                <View key={i} style={styles.trustRow}>
                  <View style={styles.trustDot} />
                  <Text style={styles.trustText}>{point}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Options */}
          {renderOptions()}
        </Animated.View>
      </ScrollView>

      {/* CTA */}
      <View style={styles.footer}>
        <PrimaryButton
          label={getButtonLabel()}
          onPress={currentStep === 5 ? handleFinish : goNext}
          disabled={!isContinueEnabled()}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 22,
    color: colors.textPrimary,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxxl,
  },
  stepContent: {
    flex: 1,
  },
  illustrationArea: {
    alignItems: 'center',
    marginVertical: spacing.xxl,
  },
  headline: {
    fontSize: typography.xl,
    fontWeight: '700',
    color: colors.textPrimary,
    maxWidth: 300,
    lineHeight: 32,
  },
  sub: {
    fontSize: typography.base,
    color: colors.textSecondary,
    lineHeight: 22,
    marginTop: spacing.sm,
  },
  optionsContainer: {
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  trustList: {
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  trustDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  trustText: {
    fontSize: typography.base,
    color: colors.textPrimary,
    lineHeight: 22,
    flex: 1,
  },
  footer: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xl,
    paddingTop: spacing.md,
  },
});
