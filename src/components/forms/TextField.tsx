import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../constants/theme';

interface Props {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  optional?: boolean;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric';
  autoCapitalize?: 'none' | 'words' | 'sentences';
  hint?: string;
}

export default function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  optional,
  multiline,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  hint,
}: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View>
      <Text style={s.label}>
        {label}
        {optional ? <Text style={s.optional}>  optional</Text> : null}
      </Text>
      <TextInput
        style={[s.input, multiline && s.multiline, focused && s.inputFocused]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
      />
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  label: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  optional: {
    fontSize: typography.xs,
    color: colors.textTertiary,
  },
  input: {
    minHeight: 58,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    fontSize: typography.md,
    color: colors.textPrimary,
    paddingHorizontal: spacing.lg,
    paddingVertical: 16,
    backgroundColor: colors.surface,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  inputFocused: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  hint: {
    fontSize: typography.xs,
    color: colors.textTertiary,
    marginTop: 5,
  },
});
