import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { format } from 'date-fns';
import { colors, spacing, typography, radius } from '../../../src/constants/theme';
import { useReportDetail } from '../../../src/hooks/useReportDetail';
import BiomarkerRow from '../../../src/components/report/BiomarkerRow';
import CategoryHeader from '../../../src/components/report/CategoryHeader';
import SummaryStrip from '../../../src/components/report/SummaryStrip';
import DetailSkeleton from '../../../src/components/report/DetailSkeleton';
import type { EnrichedBiomarker } from '../../../src/lib/biomarkerGrouping';

// ─── Flattened list item types ────────────────────────────────
type ListItem =
  | { kind: 'header'; category: string; count: number }
  | { kind: 'row'; biomarker: EnrichedBiomarker };

// ─── Screen ──────────────────────────────────────────────────
export default function ReportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { report, groups, totals, loading, error } = useReportDetail(id ?? '');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpanded(biomarkerId: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(biomarkerId)) next.delete(biomarkerId);
      else next.add(biomarkerId);
      return next;
    });
  }

  // Build flat list for FlashList
  const flatItems: ListItem[] = groups.flatMap(group => [
    { kind: 'header', category: group.category, count: group.rows.length },
    ...group.rows.map(b => ({ kind: 'row' as const, biomarker: b })),
  ]);

  const labName = report?.lab_name?.trim() || 'Blood Report';
  const reportDate = report?.report_date
    ? format(new Date(report.report_date), 'd MMM yyyy')
    : '';

  const isProcessing =
    report?.extraction_status === 'pending' ||
    report?.extraction_status === 'processing';
  const isFailed = report?.extraction_status === 'failed';
  const isComplete = report?.extraction_status === 'complete';

  return (
    <SafeAreaView style={[s.container, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Text style={s.back}>‹</Text>
        </Pressable>
        <View style={s.headerCenter}>
          {loading ? (
            <>
              <View style={s.headerTitleSkeleton} />
              <View style={s.headerSubSkeleton} />
            </>
          ) : (
            <>
              <Text style={s.headerTitle} numberOfLines={1}>{labName}</Text>
              {reportDate ? <Text style={s.headerDate}>{reportDate}</Text> : null}
            </>
          )}
        </View>
        <View style={s.backBtn} />
      </View>

      {/* ── Body ── */}
      {loading && (
        <View style={{ flex: 1 }}>
          <DetailSkeleton />
        </View>
      )}

      {!loading && error && (
        <View style={s.center}>
          <Text style={s.errorTitle}>Could not load report</Text>
          <Text style={s.errorSub}>{error}</Text>
          <Pressable onPress={() => router.back()} style={s.backButton}>
            <Text style={s.backButtonText}>Go back</Text>
          </Pressable>
        </View>
      )}

      {!loading && !error && isFailed && (
        <View style={s.center}>
          <Text style={s.errorTitle}>Extraction failed</Text>
          <Text style={s.errorSub}>
            {report?.extraction_error
              ? report.extraction_error.slice(0, 120)
              : 'We could not read this report.'}
          </Text>
          <Pressable onPress={() => router.replace('/upload')} style={s.primaryButton}>
            <Text style={s.primaryButtonText}>Try uploading again</Text>
          </Pressable>
        </View>
      )}

      {!loading && !error && isProcessing && (
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={s.processingTitle}>Analysing your report…</Text>
          <Text style={s.processingSub}>This usually takes 15–30 seconds.</Text>
        </View>
      )}

      {!loading && !error && isComplete && totals.total === 0 && (
        <View style={s.center}>
          <Text style={s.errorTitle}>No biomarkers found</Text>
          <Text style={s.errorSub}>Try uploading a clearer image or a different file.</Text>
          <Pressable onPress={() => router.back()} style={s.backButton}>
            <Text style={s.backButtonText}>Go back</Text>
          </Pressable>
        </View>
      )}

      {!loading && !error && isComplete && totals.total > 0 && (
        <FlashList
          data={flatItems}
          extraData={expanded}
          keyExtractor={item =>
            item.kind === 'header' ? `h:${item.category}` : `r:${item.biomarker.id}`
          }
          contentContainerStyle={{ paddingBottom: spacing.xxxxl }}
          ListHeaderComponent={
            <SummaryStrip
              total={totals.total}
              normal={totals.normal}
              needsAttention={totals.needsAttention}
            />
          }
          renderItem={({ item }) => {
            if (item.kind === 'header') {
              return <CategoryHeader category={item.category} count={item.count} />;
            }
            return (
              <BiomarkerRow
                biomarker={item.biomarker}
                expanded={expanded.has(item.biomarker.id)}
                onToggle={toggleExpanded}
              />
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EEE9',
  },
  backBtn: {
    width: 32,
  },
  back: {
    fontSize: 26,
    color: colors.primary,
    lineHeight: 30,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.base,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerDate: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },
  headerTitleSkeleton: {
    height: 14,
    width: 120,
    borderRadius: 6,
    backgroundColor: '#E8E6E1',
  },
  headerSubSkeleton: {
    height: 10,
    width: 80,
    borderRadius: 4,
    backgroundColor: '#E8E6E1',
    marginTop: 4,
  },

  // Centre-aligned states
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  processingTitle: {
    fontSize: typography.md,
    fontWeight: '600',
    color: colors.primary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  processingSub: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Buttons
  backButton: {
    marginTop: spacing.md,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  backButtonText: {
    fontSize: typography.base,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  primaryButton: {
    marginTop: spacing.md,
    height: 48,
    paddingHorizontal: 28,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: typography.base,
    fontWeight: '600',
    color: '#fff',
  },
});
