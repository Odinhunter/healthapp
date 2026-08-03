import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../constants/theme';
import ScalePress from '../ScalePress';
import {
  formatRefRange,
  statusLabel,
  statusVariant,
  type EnrichedBiomarker,
} from '../../lib/biomarkerGrouping';

interface Props {
  biomarker: EnrichedBiomarker;
  expanded: boolean;
  onToggle: (id: string) => void;
}

const VARIANT_STYLES = {
  normal: {
    bg: colors.surface,
    border: colors.border,
    valueColor: colors.textPrimary,
    pillBg: colors.primaryLight,
    pillText: colors.primary,
  },
  flagged: {
    bg: colors.surface,
    border: '#D09000',
    valueColor: '#854F0B',
    pillBg: '#FFF3DB',
    pillText: '#854F0B',
  },
  critical: {
    bg: '#FFF5F5',
    border: colors.danger,
    valueColor: colors.danger,
    pillBg: '#FCEBEB',
    pillText: '#A32D2D',
  },
};

export default function BiomarkerRow({ biomarker, expanded, onToggle }: Props) {
  const variant = statusVariant(biomarker.status);
  const vs = VARIANT_STYLES[variant];
  const refLine = formatRefRange(biomarker.reference_min, biomarker.reference_max);
  const meta = biomarker.canonical_biomarkers;

  const description = meta?.description ?? null;
  const meaningLine =
    biomarker.status !== 'normal'
      ? (biomarker.status === 'low' || biomarker.status === 'critical_low'
          ? meta?.low_meaning
          : meta?.high_meaning) ?? null
      : null;

  const fallbackExplanation =
    !description && !meaningLine
      ? `Your reading is ${variant === 'normal' ? 'within' : 'outside'} the reference range. Track how this trends over time.`
      : null;

  return (
    <ScalePress onPress={() => onToggle(biomarker.id)} style={[s.card, { backgroundColor: vs.bg, borderColor: vs.border }]}>
      <View style={s.main}>
        <View style={s.left}>
          <Text style={s.name} numberOfLines={expanded ? undefined : 1}>
            {biomarker.canonical_name}
          </Text>
          {refLine && <Text style={s.ref}>{refLine}</Text>}
        </View>
        <View style={s.right}>
          <Text style={[s.value, { color: vs.valueColor }]}>
            {biomarker.value} <Text style={s.unit}>{biomarker.unit}</Text>
          </Text>
          <View style={[s.pill, { backgroundColor: vs.pillBg }]}>
            <Text style={[s.pillText, { color: vs.pillText }]}>
              {statusLabel(biomarker.status)}
            </Text>
          </View>
        </View>
      </View>

      {expanded && (
        <View style={s.expansion}>
          <View style={s.expandDivider} />
          {description ? (
            <Text style={s.expandText}>{description}</Text>
          ) : null}
          {meaningLine ? (
            <Text style={[s.expandText, s.expandMeaning]}>{meaningLine}</Text>
          ) : null}
          {fallbackExplanation ? (
            <Text style={s.expandText}>{fallbackExplanation}</Text>
          ) : null}
        </View>
      )}
    </ScalePress>
  );
}

const s = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderRadius: radius.md + 2,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    marginHorizontal: spacing.xl,
  },
  main: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  left: {
    flex: 1,
  },
  name: {
    fontSize: typography.base,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  ref: {
    fontSize: typography.xs,
    color: colors.textTertiary,
    marginTop: 3,
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
  value: {
    fontSize: typography.md,
    fontWeight: '600',
  },
  unit: {
    fontSize: typography.sm,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  pill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Expanded section
  expansion: {
    marginTop: spacing.sm,
  },
  expandDivider: {
    height: 1,
    backgroundColor: '#F0EEE9',
    marginBottom: spacing.sm,
  },
  expandText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  expandMeaning: {
    marginTop: spacing.xs,
    color: colors.textPrimary,
    fontWeight: '500',
  },
});
