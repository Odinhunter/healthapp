import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../constants/theme';

interface Option<T> {
  label: string;
  value: T;
}

interface Props<T extends string | boolean> {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
}

export default function SegmentField<T extends string | boolean>({
  label,
  value,
  options,
  onChange,
}: Props<T>) {
  return (
    <View>
      <Text style={s.label}>{label}</Text>
      <View style={s.row}>
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <Pressable
              key={String(opt.value)}
              style={[s.segment, selected && s.segmentSelected]}
              onPress={() => onChange(opt.value)}
            >
              <Text style={[s.segmentText, selected && s.segmentTextSelected]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  label: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  segment: {
    flex: 1,
    height: 48,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  segmentText: {
    fontSize: typography.base,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  segmentTextSelected: {
    color: '#fff',
  },
});
