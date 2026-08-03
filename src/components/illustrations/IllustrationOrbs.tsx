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

const ORBS = [
  { fill: '#0F6E56', opacity: 0.9, stroke: '#0F6E56' },  // top-left
  { fill: '#1D9E75', opacity: 0.7, stroke: '#1D9E75' },  // top-right
  { fill: '#9CE5C8', opacity: 0.8, stroke: '#9CE5C8' },  // bottom-left
  { fill: '#E1F5EE', opacity: 0.9, stroke: '#1D9E75' },  // bottom-right
];

// 2x2 grid, 80px orbs, 16px gap, centered in 280x220
const GAP = 16;
const ORB_D = 80;
const GRID_W = ORB_D * 2 + GAP;
const GRID_H = ORB_D * 2 + GAP;
const START_X = (280 - GRID_W) / 2;
const START_Y = (220 - GRID_H) / 2;

const POSITIONS = [
  { x: START_X,             y: START_Y },              // top-left
  { x: START_X + ORB_D + GAP, y: START_Y },            // top-right
  { x: START_X,             y: START_Y + ORB_D + GAP }, // bottom-left
  { x: START_X + ORB_D + GAP, y: START_Y + ORB_D + GAP }, // bottom-right
];

function FloatingOrb({
  x, y, fill, stroke, opacity, delay,
}: {
  x: number; y: number; fill: string; stroke: string; opacity: number; delay: number;
}) {
  const translateY = useSharedValue(0);
  const cx = x + ORB_D / 2;
  const cy = y + ORB_D / 2;

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-7, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    position: 'absolute',
    left: x,
    top: y,
  }));

  return (
    <Animated.View style={animStyle}>
      <Svg width={ORB_D + 16} height={ORB_D + 16} viewBox={`0 0 ${ORB_D + 16} ${ORB_D + 16}`}>
        {/* Ring */}
        <Circle
          cx={ORB_D / 2 + 8}
          cy={ORB_D / 2 + 8}
          r={47.5}
          fill="none"
          stroke={stroke}
          strokeWidth={1.5}
          opacity={opacity * 0.5}
        />
        {/* Fill */}
        <Circle
          cx={ORB_D / 2 + 8}
          cy={ORB_D / 2 + 8}
          r={40}
          fill={fill}
          opacity={opacity}
        />
      </Svg>
    </Animated.View>
  );
}

export default function IllustrationOrbs() {
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

  return (
    <Animated.View style={[{ width: 280, height: 220 }, animatedStyle]}>
      {ORBS.map((orb, i) => (
        <FloatingOrb
          key={i}
          x={POSITIONS[i].x}
          y={POSITIONS[i].y}
          fill={orb.fill}
          stroke={orb.stroke}
          opacity={orb.opacity}
          delay={i * 300}
        />
      ))}
    </Animated.View>
  );
}
