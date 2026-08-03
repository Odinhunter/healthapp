import { Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const SPRING = { damping: 15, stiffness: 300 };

interface Props {
  onPress: () => void;
  style?: any;
  children: React.ReactNode;
  disabled?: boolean;
}

export default function ScalePress({ onPress, style, children, disabled }: Props) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Animated.View style={[animStyle, style]}>
      <Pressable
        onPressIn={() => { if (!disabled) scale.value = withSpring(0.97, SPRING); }}
        onPressOut={() => { scale.value = withSpring(1.0, SPRING); }}
        onPress={disabled ? undefined : onPress}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
