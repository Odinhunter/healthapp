import { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

// Shield centered in 280x220 canvas
// Shield shape: top-flat, sides taper, pointed bottom
const SHIELD_PATH =
  'M 140 28 L 200 52 L 200 118 C 200 152 140 180 140 180 C 140 180 80 152 80 118 L 80 52 Z';

export default function IllustrationShield() {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.85);
  const translateY = useSharedValue(0);

  useEffect(() => {
    // Mount animation
    opacity.value = withTiming(1, { duration: 600 });
    scale.value = withTiming(1.0, { duration: 600, easing: Easing.out(Easing.cubic) });

    // Float starts after mount
    translateY.value = withDelay(
      700,
      withRepeat(
        withSequence(
          withTiming(-8, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
    ],
  }));

  return (
    <Animated.View style={[{ width: 280, height: 220 }, animatedStyle]}>
      <Svg width={280} height={220} viewBox="0 0 280 220">
        {/* Glow shield (behind) */}
        <Path
          d={SHIELD_PATH}
          fill="#E1F5EE"
          opacity={0.15}
          transform="scale(1.08) translate(-10.4 -7.84)"
        />

        {/* Main shield */}
        <Path
          d={SHIELD_PATH}
          fill="#E1F5EE"
          stroke="#0F6E56"
          strokeWidth={2}
        />

        {/* Lock shackle (circle arc top) */}
        <Circle
          cx={140}
          cy={112}
          r={15}
          fill="none"
          stroke="#0F6E56"
          strokeWidth={5}
        />

        {/* Lock body */}
        <Rect
          x={120}
          y={122}
          width={40}
          height={30}
          rx={5}
          fill="#0F6E56"
        />
      </Svg>
    </Animated.View>
  );
}
