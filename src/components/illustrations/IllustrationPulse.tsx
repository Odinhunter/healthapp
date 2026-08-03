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
import Svg, { Circle } from 'react-native-svg';

const CX = 140;
const CY = 110;

function PulsingRing({
  radius,
  fill,
  opacity,
  delay,
}: {
  radius: number;
  fill: string;
  opacity: number;
  delay: number;
}) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1.12, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
          withTiming(1.0, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    position: 'absolute',
    left: CX - radius,
    top: CY - radius,
  }));

  return (
    <Animated.View style={animStyle}>
      <Svg width={radius * 2} height={radius * 2} viewBox={`0 0 ${radius * 2} ${radius * 2}`}>
        <Circle
          cx={radius}
          cy={radius}
          r={radius - 1}
          fill={fill}
          opacity={opacity}
        />
      </Svg>
    </Animated.View>
  );
}

export default function IllustrationPulse() {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // Cardinal dots at 140px radius
  const dotPositions = [
    { cx: CX,       cy: CY - 140 }, // N
    { cx: CX + 140, cy: CY },       // E
    { cx: CX,       cy: CY + 140 }, // S
    { cx: CX - 140, cy: CY },       // W
  ];

  return (
    <Animated.View style={[{ width: 280, height: 220 }, animatedStyle]}>
      {/* Outer pulsing ring */}
      <PulsingRing radius={105} fill="#E1F5EE" opacity={0.6} delay={200} />
      {/* Middle pulsing ring */}
      <PulsingRing radius={70} fill="#1D9E75" opacity={0.4} delay={0} />

      {/* Static SVG: inner circle + dots */}
      <Svg width={280} height={220} viewBox="0 0 280 220" style={{ position: 'absolute' }}>
        {/* Inner core */}
        <Circle cx={CX} cy={CY} r={40} fill="#0F6E56" />
        {/* Cardinal dots */}
        {dotPositions.map((pos, i) => (
          <Circle key={i} cx={pos.cx} cy={pos.cy} r={8} fill="#1D9E75" />
        ))}
      </Svg>
    </Animated.View>
  );
}
