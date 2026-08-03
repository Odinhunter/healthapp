import { useCallback } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { colors, spacing, typography } from '../../src/constants/theme';
import { useAuth } from '../../src/hooks/useAuth';
import { useVisits } from '../../src/hooks/useVisits';
import VisitCard from '../../src/components/visits/VisitCard';
import EmptyState from '../../src/components/common/EmptyState';
import ListSkeleton from '../../src/components/common/ListSkeleton';
import ScalePress from '../../src/components/ScalePress';
import type { DoctorVisitRow } from '../../src/types/database';

export default function VisitsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { visits, loading, error, refresh } = useVisits(user?.id);

  // Reload when returning from the add / edit screens
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const hasVisits = visits.length > 0;

  return (
    <SafeAreaView style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Text style={s.title}>Visits</Text>
      </View>

      {loading && <ListSkeleton />}

      {!loading && error && (
        <View style={s.center}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}

      {!loading && !error && !hasVisits && (
        <EmptyState
          title="No visits logged yet"
          subtitle="Keep a record of every doctor consultation, diagnosis, and follow-up."
          buttonLabel="Log a visit"
          onPress={() => router.push('/(app)/visit/new')}
        />
      )}

      {!loading && !error && hasVisits && (
        <FlashList
          data={visits}
          keyExtractor={(item: DoctorVisitRow) => item.id}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: 100 }}
          renderItem={({ item }: { item: DoctorVisitRow }) => (
            <VisitCard
              visit={item}
              onPress={() => router.push({ pathname: '/(app)/visit/[id]', params: { id: item.id } })}
            />
          )}
        />
      )}

      {hasVisits && !loading && (
        <ScalePress onPress={() => router.push('/(app)/visit/new')} style={s.fab}>
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
