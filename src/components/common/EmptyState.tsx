import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../constants/theme';
import ScalePress from '../ScalePress';

interface Props {
  title: string;
  subtitle: string;
  buttonLabel: string;
  onPress: () => void;
}

export default function EmptyState({ title, subtitle, buttonLabel, onPress }: Props) {
  return (
    <View style={s.card}>
      <Text style={s.headline}>{title}</Text>
      <Text style={s.sub}>{subtitle}</Text>
      <ScalePress onPress={onPress} style={{ width: '100%', marginTop: spacing.xl }}>
        <View style={s.button}>
          <Text style={s.buttonText}>{buttonLabel}</Text>
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
