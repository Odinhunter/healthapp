import { View } from 'react-native';
import SkeletonPulse from '../home/SkeletonPulse';
import { spacing } from '../../constants/theme';

export default function RecordsSkeleton() {
  return (
    <View style={{ paddingHorizontal: spacing.xl }}>
      {[0, 1, 2, 3].map((i) => (
        <SkeletonPulse
          key={i}
          width="100%"
          height={110}
          borderRadius={14}
          style={{ marginBottom: spacing.md }}
        />
      ))}
    </View>
  );
}
