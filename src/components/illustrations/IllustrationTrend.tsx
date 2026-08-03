import { useEffect } from 'react';
import Animated, {
  createAnimatedComponent,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';

const AnimatedPath = createAnimatedComponent(Path);

// Trend line path — starts low-left, dips slightly, rises cleanly to top-right
const LINE_PATH = 'M 20 170 C 60 175 80 155 110 145 C 140 135 160 90 200 65 C 220 52 240 45 260 38';
const AREA_PATH = 'M 20 170 C 60 175 80 155 110 145 C 140 135 160 90 200 65 C 220 52 240 45 260 38 L 260 190 L 20 190 Z';
const PATH_LENGTH = 320;

// Key points on the line
const KEY_POINTS = [
  { cx: 110, cy: 145 },
  { cx: 200, cy: 65 },
  { cx: 260, cy: 38 },
];

// Grid lines
const GRID_LINES = [48, 88, 128, 168];

export default function IllustrationTrend() {
  const strokeDashoffset = useSharedValue(PATH_LENGTH);
  const translateY = useSharedValue(0);

  useEffect(() => {
    // Draw line on mount
    strokeDashoffset.value = withTiming(0, {
      duration: 1200,
      easing: Easing.out(Easing.cubic),
    });

    // Float starts after draw completes
    translateY.value = withDelay(
      1300,
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

  const animatedLineProps = useAnimatedProps(() => ({
    strokeDashoffset: strokeDashoffset.value,
  }));

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[{ width: 280, height: 220 }, animatedStyle]}>
      <Svg width={280} height={220} viewBox="0 0 280 220">
        {/* Grid lines */}
        {GRID_LINES.map((y, i) => (
          <Line
            key={i}
            x1={10}
            y1={y}
            x2={270}
            y2={y}
            stroke="#E8E6E1"
            strokeWidth={0.5}
          />
        ))}

        {/* Area fill */}
        <Path d={AREA_PATH} fill="#E1F5EE" opacity={0.3} />

        {/* Animated trend line */}
        <AnimatedPath
          d={LINE_PATH}
          stroke="#0F6E56"
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={PATH_LENGTH}
          animatedProps={animatedLineProps}
        />

        {/* Key point dots */}
        {KEY_POINTS.map((pt, i) => (
          <Circle key={i} cx={pt.cx} cy={pt.cy} r={8} fill="#0F6E56" />
        ))}
        {KEY_POINTS.map((pt, i) => (
          <Circle key={i} cx={pt.cx} cy={pt.cy} r={4} fill="#fff" />
        ))}
      </Svg>
    </Animated.View>
  );
}
