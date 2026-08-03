import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../constants/theme';

interface Props {
  total: number;
  normal: number;
  needsAttention: number;
}

export default function SummaryStrip({ total, normal, needsAttention }: Props) {
  return (
    <View style={s.card}>
      <Stat label="Total" value={total} color={colors.textPrimary} />
      <View style={s.divider} />
      <Stat label="Normal" value={normal} color={colors.primary} />
      <View style={s.divider} />
      <Stat
        label="Attention"
        value={needsAttention}
        color={needsAttention > 0 ? '#854F0B' : colors.textTertiary}
      />
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={s.stat}>
      <Text style={[s.number, { color }]}>{value}</Text>
      <Text style={s.label}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    flexDirection: 'row',
    paddingVertical: spacing.md,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  number: {
    fontSize: typography.xl,
    fontWeight: '700',
  },
  label: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    width: 1,
    backgroundColor: '#F0EEE9',
    marginVertical: spacing.xs,
  },
});
