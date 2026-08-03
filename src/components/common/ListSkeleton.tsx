import { View } from 'react-native';
import SkeletonPulse from '../home/SkeletonPulse';
import { spacing } from '../../constants/theme';

interface Props {
  count?: number;
  height?: number;
}

export default function ListSkeleton({ count = 5, height = 92 }: Props) {
  return (
    <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.sm }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonPulse
          key={i}
          width="100%"
          height={height}
          borderRadius={16}
          style={{ marginBottom: spacing.md }}
        />
      ))}
    </View>
  );
}
