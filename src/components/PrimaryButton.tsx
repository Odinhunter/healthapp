import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { colors, radius, typography } from '../constants/theme';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export default function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
}: PrimaryButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const isInactive = disabled || loading;

  return (
    <Animated.View style={[styles.wrapper, animatedStyle]}>
      <Pressable
        style={[styles.button, isInactive && styles.buttonDisabled]}
        onPressIn={() => {
          if (!isInactive) {
            scale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
          }
        }}
        onPressOut={() => {
          if (!isInactive) {
            scale.value = withSpring(1.0, { damping: 15, stiffness: 300 });
          }
        }}
        onPress={isInactive ? undefined : onPress}
        accessible
        accessibilityRole="button"
        accessibilityState={{ disabled: isInactive }}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.label}>{label}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  button: {
    height: 58,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#B4B2A9',
  },
  label: {
    color: '#fff',
    fontSize: typography.md,
    fontWeight: '600',
  },
});
