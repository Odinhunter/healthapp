import { StyleSheet, Text, View } from 'react-native';
import { format, isFuture } from 'date-fns';
import { colors, radius, spacing, typography } from '../../constants/theme';
import ScalePress from '../ScalePress';
import type { DoctorVisitRow } from '../../types/database';

interface Props {
  visit: DoctorVisitRow;
  onPress: () => void;
}

export default function VisitCard({ visit, onPress }: Props) {
  const date = format(new Date(visit.visit_date), 'd MMM yyyy');
  const hasUpcomingFollowup =
    !!visit.followup_date && isFuture(new Date(visit.followup_date));

  return (
    <ScalePress onPress={onPress} style={s.wrapper}>
      <View style={s.card}>
        <View style={s.topRow}>
          <Text style={s.name}>{visit.doctor_name}</Text>
          <Text style={s.date}>{date}</Text>
        </View>
        {visit.specialty ? <Text style={s.specialty}>{visit.specialty}</Text> : null}
        {visit.diagnosis.length > 0 ? (
          <Text style={s.diagnosis} numberOfLines={1}>
            {visit.diagnosis.join(', ')}
          </Text>
        ) : null}
        {hasUpcomingFollowup ? (
          <View style={s.followupPill}>
            <Text style={s.followupText}>
              Follow-up {format(new Date(visit.followup_date!), 'd MMM')}
            </Text>
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
    gap: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    fontSize: typography.base,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  date: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  specialty: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  diagnosis: {
    fontSize: typography.sm,
    color: colors.textTertiary,
    marginTop: 2,
  },
  followupPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    marginTop: spacing.sm,
  },
  followupText: {
    fontSize: typography.xs,
    fontWeight: '600',
    color: colors.primary,
  },
});
