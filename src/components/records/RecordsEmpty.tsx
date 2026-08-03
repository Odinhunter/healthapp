import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, spacing, typography } from '../../constants/theme';
import EmptyReportIllustration from '../home/EmptyReportIllustration';
import ScalePress from '../ScalePress';

export default function RecordsEmpty() {
  const router = useRouter();

  return (
    <View style={s.card}>
      <View style={s.illustration}>
        <EmptyReportIllustration />
      </View>
      <Text style={s.headline}>No records yet</Text>
      <Text style={s.sub}>
        Upload your first blood report to see it here.
      </Text>
      <ScalePress onPress={() => router.push('/upload')} style={{ width: '100%', marginTop: spacing.xl }}>
        <View style={s.button}>
          <Text style={s.buttonText}>Upload report</Text>
        </View>
      </ScalePress>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 28,
    alignItems: 'center',
    marginHorizontal: spacing.xl,
    marginTop: spacing.xxxl,
  },
  illustration: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  headline: {
    fontSize: typography.md,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  sub: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  button: {
    height: 52,
    backgroundColor: colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: typography.base,
    fontWeight: '600',
  },
});
