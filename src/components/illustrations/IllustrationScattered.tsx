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
import Svg, { Circle, Rect } from 'react-native-svg';

const DOCS = [
  { x: 40,  y: 30,  w: 52, h: 36, rx: 6, rotate: -12, fill: '#E1F5EE', stroke: '#1D9E75' },
  { x: 170, y: 20,  w: 60, h: 40, rx: 6, rotate: 8,   fill: '#FAFAF9', stroke: '#E8E6E1' },
  { x: 20,  y: 120, w: 44, h: 30, rx: 5, rotate: 15,  fill: '#E1F5EE', stroke: '#1D9E75' },
  { x: 185, y: 105, w: 56, h: 38, rx: 6, rotate: -8,  fill: '#FAFAF9', stroke: '#E8E6E1' },
  { x: 95,  y: 148, w: 48, h: 34, rx: 6, rotate: 5,   fill: '#E1F5EE', stroke: '#1D9E75' },
  { x: 55,  y: 68,  w: 38, h: 26, rx: 5, rotate: -4,  fill: '#FAFAF9', stroke: '#E8E6E1' },
  { x: 155, y: 155, w: 62, h: 38, rx: 6, rotate: 18,  fill: '#E1F5EE', stroke: '#1D9E75' },
  { x: 105, y: 30,  w: 42, h: 28, rx: 5, rotate: -16, fill: '#FAFAF9', stroke: '#E8E6E1' },
];

function FloatingRect({
  x, y, w, h, rx, rotate, fill, stroke, delay,
}: {
  x: number; y: number; w: number; h: number; rx: number;
  rotate: number; fill: string; stroke: string; delay: number;
}) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-6, { duration: 2600 + delay * 0.1, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 2600 + delay * 0.1, easing: Easing.inOut(Easing.sin) }),
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
      <Svg width={w + 4} height={h + 4} viewBox={`0 0 ${w + 4} ${h + 4}`}>
        <Rect
          x={2}
          y={2}
          width={w}
          height={h}
          rx={rx}
          fill={fill}
          stroke={stroke}
          strokeWidth={1.5}
          transform={`rotate(${rotate} ${w / 2 + 2} ${h / 2 + 2})`}
        />
      </Svg>
    </Animated.View>
  );
}

export default function IllustrationScattered() {
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
      {/* Background glow circle */}
      <Svg
        width={280}
        height={220}
        viewBox="0 0 280 220"
        style={{ position: 'absolute' }}
      >
        <Circle cx={140} cy={110} r={100} fill="#E1F5EE" opacity={0.4} />
      </Svg>

      {/* Individual floating rects */}
      {DOCS.map((doc, i) => (
        <FloatingRect key={i} {...doc} delay={i * 200} />
      ))}
    </Animated.View>
  );
}
