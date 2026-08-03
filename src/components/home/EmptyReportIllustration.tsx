import { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';

export default function EmptyReportIllustration() {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, []);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[{ width: 200, height: 140 }, floatStyle]}>
      <Svg width={200} height={140} viewBox="0 0 200 140">
        {/* Background rounded rect */}
        <Rect x={10} y={10} width={180} height={120} rx={16} fill="#E1F5EE" opacity={0.3} />

        {/* Three horizontal lines — decreasing width and opacity */}
        <Rect x={40} y={42} width={120} height={8} rx={4} fill="#0F6E56" opacity={0.6} />
        <Rect x={55} y={58} width={90} height={8} rx={4} fill="#0F6E56" opacity={0.35} />
        <Rect x={70} y={74} width={60} height={8} rx={4} fill="#0F6E56" opacity={0.15} />
      </Svg>
    </Animated.View>
  );
}
