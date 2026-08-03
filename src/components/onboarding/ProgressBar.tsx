import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors, radius } from '../../constants/theme';

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

export default function ProgressBar({ currentStep, totalSteps }: ProgressBarProps) {
  const progress = useSharedValue(currentStep / totalSteps);

  useEffect(() => {
    progress.value = withTiming(currentStep / totalSteps, {
      duration: 400,
      easing: Easing.out(Easing.cubic),
    });
  }, [currentStep, totalSteps]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, animatedStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    height: 3,
    backgroundColor: colors.border,
  },
  fill: {
    height: 3,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
  },
});
