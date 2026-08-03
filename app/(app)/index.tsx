import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { format } from 'date-fns';
import { useAuth } from '../../src/hooks/useAuth';
import { useHomeData } from '../../src/hooks/useHomeData';
import SkeletonPulse from '../../src/components/home/SkeletonPulse';
import EmptyReportIllustration from '../../src/components/home/EmptyReportIllustration';
import { colors, radius, spacing, typography } from '../../src/constants/theme';
import type { BiomarkerSummaryRow } from '../../src/types/database';

const SPRING_CONFIG = { damping: 15, stiffness: 300 };

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning,';
  if (h < 17) return 'Good afternoon,';
  return 'Good evening,';
}

function getStatusLabel(status: string): string {
  if (status === 'critical_high' || status === 'critical_low') return 'CRITICAL';
  if (status === 'high') return 'HIGH';
  return 'LOW';
}

function isStatusCritical(status: string): boolean {
  return status === 'critical_high' || status === 'critical_low';
}

// ─── Pressable with spring scale ─────────────────────────────
function ScalePress({ onPress, style, children }: {
  onPress: () => void;
  style?: any;
  children: React.ReactNode;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Animated.View style={[animStyle, style]}>
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.97, SPRING_CONFIG); }}
        onPressOut={() => { scale.value = withSpring(1.0, SPRING_CONFIG); }}
        onPress={onPress}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

// ─── Skeleton loading layout ─────────────────────────────────
function SkeletonLayout() {
  return (
    <>
      <View style={styles.headerRow}>
        <View>
          <SkeletonPulse width={100} height={15} borderRadius={4} />
          <SkeletonPulse width={140} height={26} borderRadius={6} style={{ marginTop: 6 }} />
        </View>
        <SkeletonPulse width={42} height={42} borderRadius={21} />
      </View>
      <SkeletonPulse width="100%" height={180} borderRadius={16} style={{ marginTop: spacing.xxxl }} />
      <SkeletonPulse width="100%" height={64} borderRadius={12} style={{ marginTop: spacing.xl }} />
      <SkeletonPulse width="100%" height={64} borderRadius={12} style={{ marginTop: spacing.sm }} />
    </>
  );
}

// ─── Empty state ─────────────────────────────────────────────
function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIllustrationWrap}>
        <EmptyReportIllustration />
      </View>
      <Text style={styles.emptyHeadline}>Your health story starts here</Text>
      <Text style={styles.emptySubtext}>
        Upload your first blood report and we'll turn it into insights you can actually understand.
      </Text>
      <ScalePress onPress={onUpload} style={{ width: '100%', marginTop: spacing.xl }}>
        <View style={styles.emptyButton}>
          <Text style={styles.emptyButtonText}>Upload your first report</Text>
        </View>
      </ScalePress>
    </View>
  );
}

// ─── Stat pill ───────────────────────────────────────────────
function StatPill({ count, label, variant }: {
  count: number;
  label: string;
  variant: 'normal' | 'flagged' | 'critical';
}) {
  const bg = variant === 'normal' ? colors.primaryLight
    : variant === 'flagged' ? '#FFF3DB' : '#FCEBEB';
  const numColor = variant === 'normal' ? colors.primary
    : variant === 'flagged' ? '#854F0B' : '#A32D2D';

  return (
    <View style={[styles.statPill, { backgroundColor: bg }]}>
      <Text style={[styles.statNumber, { color: numColor }]}>{count}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Flagged biomarker row ───────────────────────────────────
function FlaggedRow({ biomarker, onPress }: { biomarker: BiomarkerSummaryRow; onPress: () => void }) {
  const critical = isStatusCritical(biomarker.latest_status);
  const badgeLabel = getStatusLabel(biomarker.latest_status);

  return (
    <ScalePress onPress={onPress} style={{ marginBottom: spacing.sm }}>
      <View style={styles.flaggedCard}>
        <View style={styles.flaggedLeft}>
          <Text style={styles.flaggedName}>{biomarker.canonical_name}</Text>
          <Text style={styles.flaggedValue}>
            {biomarker.latest_value} {biomarker.latest_unit}
          </Text>
        </View>
        <View style={[
          styles.statusBadge,
          { backgroundColor: critical ? '#FCEBEB' : '#FFF3DB' },
        ]}>
          <Text style={[
            styles.statusBadgeText,
            { color: critical ? '#A32D2D' : '#854F0B' },
          ]}>
            {badgeLabel}
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </View>
    </ScalePress>
  );
}

// ─── Main screen ─────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { loading, firstName, latestReport, statusCounts, flaggedBiomarkers, totalFlagged } = useHomeData(user?.id);

  const hasReport = !!latestReport;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <SkeletonLayout />
        ) : (
          <>
            {/* Header */}
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.greeting}>{getGreeting()}</Text>
                <Text style={styles.name}>{firstName || 'there'}</Text>
              </View>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(firstName || '?')[0].toUpperCase()}
                </Text>
              </View>
            </View>

            {!hasReport ? (
              <EmptyState onUpload={() => router.push('/upload')} />
            ) : (
              <>
                {/* Latest report */}
                <Text style={styles.sectionLabel}>Latest report</Text>
                <ScalePress onPress={() => router.push(`/(app)/report/${latestReport.id}`)}>
                  <View style={styles.reportCard}>
                    <View style={styles.reportTopRow}>
                      <Text style={styles.labName}>
                        {latestReport.lab_name?.trim() || 'Blood Report'}
                      </Text>
                      <Text style={styles.reportDate}>
                        {format(new Date(latestReport.report_date), 'd MMM yyyy')}
                      </Text>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.pillRow}>
                      <StatPill count={statusCounts.normal} label="Normal" variant="normal" />
                      {statusCounts.flagged > 0 && (
                        <StatPill count={statusCounts.flagged} label="Flagged" variant="flagged" />
                      )}
                      {statusCounts.critical > 0 && (
                        <StatPill count={statusCounts.critical} label="Critical" variant="critical" />
                      )}
                    </View>

                    <Pressable onPress={() => router.push(`/(app)/report/${latestReport.id}`)} style={styles.viewResults}>
                      <Text style={styles.viewResultsText}>View full results →</Text>
                    </Pressable>
                  </View>
                </ScalePress>

                {/* Flagged biomarkers */}
                {flaggedBiomarkers.length > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, { marginTop: 28 }]}>
                      Needs attention
                    </Text>
                    {flaggedBiomarkers.map((b) => (
                      <FlaggedRow
                        key={b.id}
                        biomarker={b}
                        onPress={() => router.push({
                          pathname: '/(app)/trend/[canonicalName]',
                          params: { canonicalName: b.canonical_name },
                        })}
                      />
                    ))}
                    {totalFlagged > 3 && (
                      <Pressable style={styles.seeAll}>
                        <Text style={styles.seeAllText}>See all →</Text>
                      </Pressable>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* FAB — upload button, only when data state */}
      {hasReport && !loading && (
        <ScalePress onPress={() => router.push('/upload')} style={styles.fab}>
          <View style={styles.fabCircle}>
            <Text style={styles.fabIcon}>+</Text>
          </View>
        </ScalePress>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: 100,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: typography.base,
    color: colors.textSecondary,
  },
  name: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 2,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: typography.md,
    fontWeight: '600',
    color: colors.primary,
  },

  // Section label
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing.xxxl,
    marginBottom: 10,
  },

  // Report card
  reportCard: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.lg,
  },
  reportTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  reportDate: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0EEE9',
    marginVertical: spacing.md,
  },
  pillRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: typography.lg,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  viewResults: {
    marginTop: spacing.md,
  },
  viewResultsText: {
    fontSize: typography.sm,
    color: colors.primary,
  },

  // Empty state
  emptyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 28,
    alignItems: 'center',
    marginTop: spacing.xxxl,
  },
  emptyIllustrationWrap: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emptyHeadline: {
    fontSize: typography.md,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  emptyButton: {
    height: 52,
    backgroundColor: colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: typography.base,
    fontWeight: '600',
  },

  // Flagged biomarker rows
  flaggedCard: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  flaggedLeft: {
    flex: 1,
  },
  flaggedName: {
    fontSize: typography.base,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  flaggedValue: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  statusBadgeText: {
    fontSize: typography.xs,
    fontWeight: '600',
  },
  chevron: {
    fontSize: 16,
    color: colors.textTertiary,
    marginLeft: spacing.sm,
  },
  seeAll: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  seeAllText: {
    fontSize: typography.sm,
    color: colors.primary,
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
