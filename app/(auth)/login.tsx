import { useRef, useState } from 'react';
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
import { useRouter } from 'expo-router';
import PrimaryButton from '../../src/components/PrimaryButton';
import { sendEmailOTP } from '../../src/lib/auth';
import { colors, radius, spacing, typography } from '../../src/constants/theme';

function isValidEmail(value: string) {
  return value.includes('@') && value.includes('.');
}

export default function LoginScreen() {
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChangeText = (text: string) => {
    setError(null);
    setEmail(text);
  };

  const handleSend = async () => {
    setLoading(true);
    setError(null);
    const { error: sendError } = await sendEmailOTP(email.trim());
    setLoading(false);
    if (sendError) {
      setError(sendError.message ?? 'Failed to send OTP. Please try again.');
      return;
    }
    router.push({ pathname: '/(auth)/verify', params: { email: email.trim() } });
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
          {/* Back */}
          <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
            <Text style={styles.backArrow}>←</Text>
          </Pressable>

          <Text style={styles.headline}>What's your email?</Text>
          <Text style={styles.subtext}>We'll send you a one-time verification code.</Text>

          {/* Email input */}
          <TextInput
            ref={inputRef}
            style={[styles.input, focused && styles.inputFocused]}
            value={email}
            onChangeText={handleChangeText}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            placeholder="you@example.com"
            placeholderTextColor={colors.textTertiary}
            returnKeyType="done"
            onSubmitEditing={isValidEmail(email) ? handleSend : undefined}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton
            label="Send code"
            onPress={handleSend}
            disabled={!isValidEmail(email)}
            loading={loading}
          />
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
  input: {
    height: 58,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    fontSize: typography.md,
    color: colors.textPrimary,
    marginTop: spacing.xxxl,
  },
  inputFocused: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  error: {
    fontSize: typography.sm,
    color: colors.danger,
    marginTop: spacing.sm,
  },
  footer: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xl,
    paddingTop: spacing.md,
  },
});
