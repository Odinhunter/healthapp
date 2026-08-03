import { Dimensions, View } from 'react-native';
import SkeletonPulse from '../home/SkeletonPulse';
import { spacing } from '../../constants/theme';

const W = Dimensions.get('window').width - spacing.xl * 2;

export default function DetailSkeleton() {
  return (
    <View style={{ flex: 1 }}>
      {/* Summary strip */}
      <SkeletonPulse width={W} height={72} borderRadius={14} style={{ marginHorizontal: spacing.xl, marginBottom: spacing.lg }} />

      {/* Category section × 3 */}
      {[0, 1, 2].map((si) => (
        <View key={si}>
          <SkeletonPulse width={120} height={11} borderRadius={4} style={{ marginHorizontal: spacing.xl, marginTop: spacing.xl, marginBottom: spacing.sm }} />
          {[0, 1, 2, 3].map((ri) => (
            <SkeletonPulse
              key={ri}
              width={W}
              height={70}
              borderRadius={12}
              style={{ marginHorizontal: spacing.xl, marginBottom: spacing.sm }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
