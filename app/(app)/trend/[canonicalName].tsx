import {
  Dimensions,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { useAuth } from '../../../src/hooks/useAuth';
import { useBiomarkerTrend } from '../../../src/hooks/useBiomarkerTrend';
import SkeletonPulse from '../../../src/components/home/SkeletonPulse';
import TrendChart from '../../../src/components/trend/TrendChart';
import { colors, radius, spacing, typography } from '../../../src/constants/theme';
import { statusVariant } from '../../../src/lib/biomarkerGrouping';

const CARD_PADDING = spacing.lg;

type TrendKind = 'improving' | 'worsening' | 'stable';

function trendPillStyle(trend: TrendKind): { bg: string; text: string; label: string } {
  if (trend === 'improving') return { bg: colors.primaryLight, text: colors.primary, label: 'Improving' };
  if (trend === 'worsening') return { bg: '#FCEBEB', text: '#A32D2D', label: 'Worsening' };
  return { bg: '#F0EEE9', text: colors.textSecondary, label: 'Stable' };
}

function formatRange(min: number | null, max: number | null, unit: string): string {
  if (min != null && max != null) return `${min} – ${max} ${unit}`;
  if (max != null) return `Below ${max} ${unit}`;
  if (min != null) return `Above ${min} ${unit}`;
  return 'Not available';
}

export default function TrendScreen() {
  const { canonicalName } = useLocalSearchParams<{ canonicalName: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { biomarkers, canonical, summary, loading, error } = useBiomarkerTrend(
    user?.id,
    canonicalName,
  );

  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - spacing.xl * 2 - CARD_PADDING * 2;

  const latest = biomarkers.length > 0 ? biomarkers[biomarkers.length - 1] : null;
  const latestVariant = latest ? statusVariant(latest.status) : 'normal';

  const refMin = canonical?.reference_min_male ?? null;
  const refMax = canonical?.reference_max_male ?? null;
  const unit = canonical?.unit_standard ?? latest?.unit ?? '';

  const meaning =
    latest && latestVariant !== 'normal'
      ? latest.status === 'low' || latest.status === 'critical_low'
        ? canonical?.low_meaning ?? null
        : canonical?.high_meaning ?? null
      : null;

  const pillTrend: TrendKind | null =
    summary?.trend === 'improving' || summary?.trend === 'worsening' || summary?.trend === 'stable'
      ? summary.trend
      : null;

  return (
    <SafeAreaView style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Text style={s.back}>‹</Text>
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle} numberOfLines={1}>
            {canonicalName}
          </Text>
          {canonical?.category ? (
            <Text style={s.headerSub}>{canonical.category}</Text>
          ) : null}
        </View>
        <View style={s.backBtn} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {loading && <TrendSkeleton />}

        {!loading && error && (
          <View style={s.center}>
            <Text style={s.errorTitle}>Could not load trend</Text>
            <Text style={s.errorSub}>{error}</Text>
            <Pressable onPress={() => router.back()} style={s.secondaryButton}>
              <Text style={s.secondaryButtonText}>Go back</Text>
            </Pressable>
          </View>
        )}

        {!loading && !error && biomarkers.length < 2 && (
          <View style={s.emptyCard}>
            <Text style={s.emptyTitle}>Not enough data yet</Text>
            <Text style={s.emptySub}>Upload another report to see your trend.</Text>
          </View>
        )}

        {!loading && !error && biomarkers.length >= 2 && latest && (
          <>
            <View style={s.summaryCard}>
              <View style={s.summaryRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.summaryLabel}>Latest reading</Text>
                  <Text style={s.summaryValue}>
                    {latest.value} <Text style={s.summaryUnit}>{latest.unit}</Text>
                  </Text>
                  <Text style={s.summaryDate}>
                    {format(new Date(latest.report_date), 'd MMM yyyy')}
                  </Text>
                </View>
                {pillTrend ? <TrendPill trend={pillTrend} /> : null}
              </View>
            </View>

            <View style={s.chartCard}>
              <TrendChart
                biomarkers={biomarkers}
                referenceMin={refMin}
                referenceMax={refMax}
                width={chartWidth}
              />
            </View>

            <View style={s.infoCard}>
              <Text style={s.infoLabel}>Reference range</Text>
              <Text style={s.infoValue}>{formatRange(refMin, refMax, unit)}</Text>
            </View>

            {meaning ? (
              <View
                style={[
                  s.callout,
                  latestVariant === 'critical' ? s.calloutCritical : s.calloutFlagged,
                ]}
              >
                <Text
                  style={[
                    s.calloutLabel,
                    { color: latestVariant === 'critical' ? '#A32D2D' : '#854F0B' },
                  ]}
                >
                  {latestVariant === 'critical' ? 'Critical' : 'What this means'}
                </Text>
                <Text style={s.calloutBody}>{meaning}</Text>
              </View>
            ) : null}

            {canonical?.description ? (
              <View style={s.infoCard}>
                <Text style={s.infoLabel}>About this marker</Text>
                <Text style={s.infoBody}>{canonical.description}</Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TrendPill({ trend }: { trend: TrendKind }) {
  const style = trendPillStyle(trend);
  return (
    <View style={[s.pill, { backgroundColor: style.bg }]}>
      <Text style={[s.pillText, { color: style.text }]}>{style.label}</Text>
    </View>
  );
}

function TrendSkeleton() {
  return (
    <>
      <SkeletonPulse width="100%" height={104} borderRadius={radius.lg} />
      <SkeletonPulse
        width="100%"
        height={232}
        borderRadius={radius.lg}
        style={{ marginTop: spacing.md }}
      />
      <SkeletonPulse
        width="100%"
        height={72}
        borderRadius={radius.lg}
        style={{ marginTop: spacing.md }}
      />
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EEE9',
  },
  backBtn: { width: 32 },
  back: { fontSize: 26, color: colors.primary, lineHeight: 30 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: {
    fontSize: typography.base,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerSub: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },

  scroll: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxxl,
    gap: spacing.md,
  },

  summaryCard: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  summaryLabel: {
    fontSize: typography.xs,
    fontWeight: '600',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  summaryValue: {
    fontSize: typography.xxl,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 4,
  },
  summaryUnit: {
    fontSize: typography.md,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  summaryDate: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginTop: 4,
  },

  pill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  pillText: {
    fontSize: typography.xs,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  chartCard: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: CARD_PADDING,
    alignItems: 'center',
  },

  infoCard: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  infoLabel: {
    fontSize: typography.xs,
    fontWeight: '600',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  infoValue: {
    fontSize: typography.base,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  infoBody: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  callout: {
    borderWidth: 1.5,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  calloutFlagged: {
    backgroundColor: '#FFF3DB',
    borderColor: '#D09000',
  },
  calloutCritical: {
    backgroundColor: '#FFF5F5',
    borderColor: colors.danger,
  },
  calloutLabel: {
    fontSize: typography.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  calloutBody: {
    fontSize: typography.sm,
    color: colors.textPrimary,
    lineHeight: 20,
  },

  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xxxxl,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  errorTitle: {
    fontSize: typography.md,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  errorSub: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
  secondaryButton: {
    marginTop: spacing.md,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    fontSize: typography.base,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  emptyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: typography.md,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
});
