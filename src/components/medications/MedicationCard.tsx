import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../constants/theme';
import ScalePress from '../ScalePress';
import type { MedicationRow } from '../../types/database';

interface Props {
  medication: MedicationRow;
  onPress: () => void;
}

function dosageLine(m: MedicationRow): string {
  const dose = [m.dosage, m.dosage_unit].filter(Boolean).join(' ').trim();
  return [dose, m.frequency].filter(Boolean).join(' · ');
}

export default function MedicationCard({ medication, onPress }: Props) {
  const subtitle = dosageLine(medication);

  return (
    <ScalePress onPress={onPress} style={s.wrapper}>
      <View style={s.card}>
        <View style={s.left}>
          <Text style={s.name}>{medication.name}</Text>
          {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
        </View>
        {medication.with_food ? (
          <View style={s.foodPill}>
            <Text style={s.foodText}>With food</Text>
          </View>
        ) : null}
      </View>
    </ScalePress>
  );
}

const s = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg + 2,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  left: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontSize: typography.base,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  foodPill: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    marginLeft: spacing.sm,
  },
  foodText: {
    fontSize: typography.xs,
    fontWeight: '600',
    color: colors.primary,
  },
});
