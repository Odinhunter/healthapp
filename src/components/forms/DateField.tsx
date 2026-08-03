import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { colors, radius, spacing, typography } from '../../constants/theme';

interface Props {
  label: string;
  value: Date | null;
  onChange: (d: Date) => void;
  optional?: boolean;
  placeholder?: string;
  maximumDate?: Date;
  minimumDate?: Date;
  onClear?: () => void;
}

export default function DateField({
  label,
  value,
  onChange,
  optional,
  placeholder = 'Select date',
  maximumDate,
  minimumDate,
  onClear,
}: Props) {
  const [show, setShow] = useState(false);

  const renderPicker = () => {
    if (!show) return null;

    if (Platform.OS === 'android') {
      return (
        <DateTimePicker
          value={value ?? new Date()}
          mode="date"
          display="default"
          maximumDate={maximumDate}
          minimumDate={minimumDate}
          onChange={(event, selected) => {
            setShow(false);
            if (event.type === 'set' && selected) onChange(selected);
          }}
        />
      );
    }

    return (
      <Modal transparent animationType="slide" visible={show}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Pressable onPress={() => setShow(false)}>
                <Text style={s.modalDone}>Done</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={value ?? new Date()}
              mode="date"
              display="spinner"
              maximumDate={maximumDate}
              minimumDate={minimumDate}
              onChange={(event, selected) => {
                if (event.type === 'set' && selected) onChange(selected);
              }}
            />
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View>
      <Text style={s.label}>
        {label}
        {optional ? <Text style={s.optional}>  optional</Text> : null}
      </Text>
      <Pressable style={s.field} onPress={() => setShow(true)}>
        <Text style={value ? s.value : s.placeholder}>
          {value ? format(value, 'd MMMM yyyy') : placeholder}
        </Text>
        {value && onClear ? (
          <Pressable hitSlop={10} onPress={onClear}>
            <Text style={s.clear}>✕</Text>
          </Pressable>
        ) : null}
      </Pressable>
      {renderPicker()}
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
  field: {
    height: 58,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  value: {
    fontSize: typography.md,
    color: colors.textPrimary,
  },
  placeholder: {
    fontSize: typography.md,
    color: colors.textTertiary,
  },
  clear: {
    fontSize: typography.base,
    color: colors.textTertiary,
    paddingLeft: spacing.md,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing.xxxl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  modalDone: {
    fontSize: typography.md,
    color: colors.primary,
    fontWeight: '600',
  },
});
