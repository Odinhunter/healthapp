import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { colors, spacing, typography, radius } from '../../src/constants/theme';
import { useAuth } from '../../src/hooks/useAuth';
import { useReports } from '../../src/hooks/useReports';
import ReportCard from '../../src/components/records/ReportCard';
import RecordsEmpty from '../../src/components/records/RecordsEmpty';
import RecordsSkeleton from '../../src/components/records/RecordsSkeleton';
import ScalePress from '../../src/components/ScalePress';
import type { ReportWithCounts } from '../../src/hooks/useReports';

export default function RecordsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { reports, loading, loadingMore, hasMore, error, loadMore } = useReports(user?.id);

  const hasReports = reports.length > 0;

  return (
    <SafeAreaView style={[s.container, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <Text style={s.title}>Records</Text>
      </View>

      {/* ── Body ── */}
      {loading && <RecordsSkeleton />}

      {!loading && error && (
        <View style={s.center}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}

      {!loading && !error && !hasReports && <RecordsEmpty />}

      {!loading && !error && hasReports && (
        <FlashList
          data={reports}
          keyExtractor={(item: ReportWithCounts) => item.id}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: 100 }}
          onEndReached={hasMore ? loadMore : undefined}
          onEndReachedThreshold={0.5}
          renderItem={({ item }: { item: ReportWithCounts }) => (
            <ReportCard
              report={item}
              onPress={() => router.push(`/(app)/report/${item.id}`)}
            />
          )}
          ListFooterComponent={
            loadingMore
              ? <View style={s.footer}><ActivityIndicator color={colors.primary} /></View>
              : null
          }
        />
      )}

      {/* ── FAB ── */}
      {hasReports && !loading && (
        <ScalePress onPress={() => router.push('/upload')} style={s.fab}>
          <View style={s.fabCircle}>
            <Text style={s.fabIcon}>+</Text>
          </View>
        </ScalePress>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: typography.xxl,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  errorText: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  footer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 20,
  },
  fabCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabIcon: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '500',
    lineHeight: 30,
  },
});
