import { useCallback } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../../src/constants/theme';
import { useAuth } from '../../src/hooks/useAuth';
import { useMedications } from '../../src/hooks/useMedications';
import MedicationCard from '../../src/components/medications/MedicationCard';
import EmptyState from '../../src/components/common/EmptyState';
import ListSkeleton from '../../src/components/common/ListSkeleton';
import ScalePress from '../../src/components/ScalePress';
import type { MedicationRow } from '../../src/types/database';

export default function MedicationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { active, past, loading, error, refresh } = useMedications(user?.id);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const openMed = (m: MedicationRow) =>
    router.push({ pathname: '/(app)/medication/[id]', params: { id: m.id } });

  const hasAny = active.length > 0 || past.length > 0;

  return (
    <SafeAreaView style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Text style={s.title}>Medications</Text>
      </View>

      {loading && <ListSkeleton />}

      {!loading && error && (
        <View style={s.center}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}

      {!loading && !error && !hasAny && (
        <EmptyState
          title="No medications yet"
          subtitle="Track active prescriptions, dosages, and who prescribed them."
          buttonLabel="Add a medication"
          onPress={() => router.push('/(app)/medication/new')}
        />
      )}

      {!loading && !error && hasAny && (
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
        >
          {active.length > 0 && (
            <>
              <Text style={s.sectionLabel}>Active</Text>
              {active.map((m) => (
                <MedicationCard key={m.id} medication={m} onPress={() => openMed(m)} />
              ))}
            </>
          )}

          {past.length > 0 && (
            <>
              <Text style={[s.sectionLabel, active.length > 0 && { marginTop: spacing.lg }]}>
                Past
              </Text>
              {past.map((m) => (
                <MedicationCard key={m.id} medication={m} onPress={() => openMed(m)} />
              ))}
            </>
          )}
        </ScrollView>
      )}

      {hasAny && !loading && (
        <ScalePress onPress={() => router.push('/(app)/medication/new')} style={s.fab}>
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
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 100,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
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
