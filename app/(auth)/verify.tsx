import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import PrimaryButton from '../../src/components/PrimaryButton';
import { verifyEmailOTP, sendEmailOTP } from '../../src/lib/auth';
import { supabase } from '../../src/lib/supabase';
import { colors, radius, spacing, typography } from '../../src/constants/theme';

const OTP_LENGTH = 6;

export default function VerifyScreen() {
  const router = useRouter();
  const { email: emailParam } = useLocalSearchParams<{ email: string }>();
  const email = Array.isArray(emailParam) ? emailParam[0] : emailParam;

  const inputRef = useRef<TextInput>(null);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(30);

  const shakeX = useSharedValue(0);

  // Resend countdown using setTimeout chain
  useEffect(() => {
    if (resendTimer === 0) return;
    const id = setTimeout(() => setResendTimer((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [resendTimer]);

  // Auto-focus hidden input on mount
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  const shakeAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const triggerShake = () => {
    shakeX.value = withSequence(
      withTiming(-10, { duration: 60 }),
      withTiming(10, { duration: 60 }),
      withTiming(-8, { duration: 60 }),
      withTiming(8, { duration: 60 }),
      withTiming(0, { duration: 60 }),
    );
  };

  const handleVerify = async (otpValue: string) => {
    if (otpValue.length !== OTP_LENGTH) return;
    setLoading(true);
    setError(null);
    try {
      const { error: verifyError } = await verifyEmailOTP(email, otpValue);
      if (verifyError) throw verifyError;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication failed');

      // Flush onboarding answers to profile
      const raw = await AsyncStorage.getItem('onboarding_answers');
      if (raw) {
        await supabase
          .from('profiles')
          .update({
            onboarding_data: JSON.parse(raw) as Record<string, unknown>,
            onboarding_complete: true,
          })
          .eq('id', user.id);
        await AsyncStorage.removeItem('onboarding_answers');
      }

      // Check if primary family member exists
      const { data: primary } = await supabase
        .from('family_members')
        .select('id')
        .eq('owner_id', user.id)
        .eq('is_primary', true)
        .maybeSingle();

      router.replace(primary ? '/(app)' : '/(auth)/create-profile');
    } catch (e) {
      setOtp('');
      triggerShake();
      setError(e instanceof Error ? e.message : 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeText = (text: string) => {
    setError(null);
    const cleaned = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setOtp(cleaned);
    if (cleaned.length === OTP_LENGTH) {
      handleVerify(cleaned);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    try {
      await sendEmailOTP(email);
      setResendTimer(30);
      setOtp('');
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to resend code');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
            <Text style={styles.backArrow}>←</Text>
          </Pressable>

          <Text style={styles.headline}>Enter the code</Text>
          <Text style={styles.subtext}>Sent to {email}</Text>

          {/* OTP display + hidden real input */}
          <Animated.View style={[styles.otpRow, shakeAnimStyle]}>
            {Array.from({ length: OTP_LENGTH }, (_, i) => {
              const isFilled = i < otp.length;
              const isActive = otp.length === i;
              return (
                <Pressable key={i} onPress={() => inputRef.current?.focus()}>
                  <View
                    style={[
                      styles.otpBox,
                      isFilled && styles.otpBoxFilled,
                      isActive && styles.otpBoxActive,
                    ]}
                  >
                    <Text style={styles.otpDigit}>{otp[i] ?? ''}</Text>
                  </View>
                </Pressable>
              );
            })}
          </Animated.View>

          {/* Hidden real input */}
          <TextInput
            ref={inputRef}
            value={otp}
            onChangeText={handleChangeText}
            keyboardType="number-pad"
            maxLength={OTP_LENGTH}
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            style={styles.hiddenInput}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton
            label="Verify"
            onPress={() => handleVerify(otp)}
            disabled={otp.length !== OTP_LENGTH}
            loading={loading}
          />

          <Pressable
            onPress={handleResend}
            disabled={resendTimer > 0}
            style={styles.resendButton}
          >
            <Text style={[styles.resendText, resendTimer > 0 && styles.resendDisabled]}>
              {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend code'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxl,
  },
  backArrow: {
    fontSize: 22,
    color: colors.textPrimary,
  },
  headline: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtext: {
    fontSize: typography.base,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  otpRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xxxl,
    justifyContent: 'center',
  },
  otpBox: {
    width: 42,
    height: 56,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxActive: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  otpBoxFilled: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  otpDigit: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0.01,
    width: 1,
    height: 1,
  },
  error: {
    fontSize: typography.sm,
    color: colors.danger,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  resendButton: {
    alignItems: 'center',
    padding: spacing.sm,
  },
  resendText: {
    fontSize: typography.base,
    color: colors.primary,
    fontWeight: '500',
  },
  resendDisabled: {
    color: colors.textTertiary,
  },
});
