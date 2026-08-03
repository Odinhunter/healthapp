import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../../constants/theme';

interface Props {
  category: string;
  count: number;
}

export default function CategoryHeader({ category, count }: Props) {
  return (
    <View style={s.row}>
      <Text style={s.label}>{category.toUpperCase()}</Text>
      <Text style={s.count}>{count}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textTertiary,
    letterSpacing: 0.8,
  },
  count: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textTertiary,
  },
});
