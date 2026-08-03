import { StyleSheet, Text, View } from 'react-native';
import { format } from 'date-fns';
import { colors, radius, spacing, typography } from '../../constants/theme';
import ScalePress from '../ScalePress';
import type { ReportWithCounts } from '../../hooks/useReports';

interface Props {
  report: ReportWithCounts;
  onPress: () => void;
}

export default function ReportCard({ report, onPress }: Props) {
  const labName = report.lab_name?.trim() || 'Blood Report';
  const date = format(new Date(report.report_date), 'd MMM yyyy');
  const isComplete = report.extraction_status === 'complete';
  const { normal, flagged, critical } = report.counts;
  const allNormal = isComplete && flagged === 0 && critical === 0 && report.biomarker_count > 0;

  return (
    <ScalePress onPress={onPress} style={s.wrapper}>
      <View style={s.card}>
        <Text style={s.labName}>{labName}</Text>
        <Text style={s.date}>{date}</Text>

        <View style={s.bottomRow}>
          {isComplete ? (
            <Text style={s.count}>{report.biomarker_count} biomarkers</Text>
          ) : (
            <Text style={s.count}>—</Text>
          )}

          <View style={s.pills}>
            {!isComplete && (
              <Pill
                label={report.extraction_status === 'failed' ? 'Failed' : 'Processing…'}
                bg={report.extraction_status === 'failed' ? '#FCEBEB' : colors.primaryLight}
                color={report.extraction_status === 'failed' ? '#A32D2D' : colors.primary}
              />
            )}
            {isComplete && allNormal && (
              <Pill label="All normal" bg={colors.primaryLight} color={colors.primary} />
            )}
            {isComplete && flagged > 0 && (
              <Pill label={`${flagged} flagged`} bg="#FFF3DB" color="#854F0B" />
            )}
            {isComplete && critical > 0 && (
              <Pill label={`${critical} critical`} bg="#FCEBEB" color="#A32D2D" />
            )}
          </View>
        </View>
      </View>
    </ScalePress>
  );
}

function Pill({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <View style={[s.pill, { backgroundColor: bg }]}>
      <Text style={[s.pillText, { color }]}>{label}</Text>
    </View>
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
  labName: {
    fontSize: typography.base,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  date: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  count: {
    fontSize: typography.sm,
    color: colors.textTertiary,
  },
  pills: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  pillText: {
    fontSize: typography.xs,
    fontWeight: '600',
  },
});
