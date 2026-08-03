import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import PrimaryButton from '../PrimaryButton';
import TextField from '../forms/TextField';
import DateField from '../forms/DateField';
import SegmentField from '../forms/SegmentField';
import { colors, spacing, typography } from '../../constants/theme';
import { medicationFormToFields, type MedicationFormValues } from '../../lib/medicationForm';

// Re-exported so screens can import the form + its helpers from one place.
export { medicationFormToFields };
export type { MedicationFormValues };

interface Props {
  initial?: Partial<MedicationFormValues>;
  submitting: boolean;
  submitLabel: string;
  onSubmit: (values: MedicationFormValues) => void;
}

export default function MedicationForm({ initial, submitting, submitLabel, onSubmit }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [genericName, setGenericName] = useState(initial?.generic_name ?? '');
  const [dosage, setDosage] = useState(initial?.dosage ?? '');
  const [dosageUnit, setDosageUnit] = useState(initial?.dosage_unit ?? '');
  const [frequency, setFrequency] = useState(initial?.frequency ?? '');
  const [startDate, setStartDate] = useState<Date>(initial?.start_date ?? new Date());
  const [endDate, setEndDate] = useState<Date | null>(initial?.end_date ?? null);
  const [withFood, setWithFood] = useState<boolean>(initial?.with_food ?? false);
  const [isActive, setIsActive] = useState<boolean>(initial?.is_active ?? true);
  const [prescribedBy, setPrescribedBy] = useState(initial?.prescribed_by ?? '');
  const [reason, setReason] = useState(initial?.reason ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && frequency.trim().length > 0;

  const handleSubmit = () => {
    if (!name.trim()) {
      setError('Please enter the medication name.');
      return;
    }
    if (!frequency.trim()) {
      setError('Please enter how often it’s taken.');
      return;
    }
    setError(null);
    onSubmit({
      name,
      generic_name: genericName,
      dosage,
      dosage_unit: dosageUnit,
      frequency,
      start_date: startDate,
      end_date: endDate,
      with_food: withFood,
      is_active: isActive,
      prescribed_by: prescribedBy,
      reason,
      notes,
    });
  };

  return (
    <View style={s.form}>
      <TextField
        label="Medication name"
        value={name}
        onChangeText={(t) => { setName(t); setError(null); }}
        placeholder="Metformin"
        autoCapitalize="words"
      />
      <TextField
        label="Generic name"
        value={genericName}
        onChangeText={setGenericName}
        placeholder="Metformin hydrochloride"
        optional
        autoCapitalize="words"
      />
      <View style={s.row}>
        <View style={s.rowItem}>
          <TextField
            label="Dosage"
            value={dosage}
            onChangeText={setDosage}
            placeholder="500"
            optional
            keyboardType="numeric"
          />
        </View>
        <View style={s.rowItem}>
          <TextField
            label="Unit"
            value={dosageUnit}
            onChangeText={setDosageUnit}
            placeholder="mg"
            optional
            autoCapitalize="none"
          />
        </View>
      </View>
      <TextField
        label="Frequency"
        value={frequency}
        onChangeText={(t) => { setFrequency(t); setError(null); }}
        placeholder="Twice daily"
      />
      <SegmentField
        label="Take with food?"
        value={withFood}
        options={[{ label: 'No', value: false }, { label: 'Yes', value: true }]}
        onChange={setWithFood}
      />
      <DateField
        label="Start date"
        value={startDate}
        onChange={setStartDate}
      />
      <DateField
        label="End date"
        value={endDate}
        onChange={setEndDate}
        optional
        placeholder="Ongoing"
        onClear={() => setEndDate(null)}
      />
      <SegmentField
        label="Status"
        value={isActive}
        options={[{ label: 'Active', value: true }, { label: 'Stopped', value: false }]}
        onChange={setIsActive}
      />
      <TextField
        label="Prescribed by"
        value={prescribedBy}
        onChangeText={setPrescribedBy}
        placeholder="Dr. Sharma"
        optional
        autoCapitalize="words"
      />
      <TextField
        label="Reason"
        value={reason}
        onChangeText={setReason}
        placeholder="Type 2 diabetes"
        optional
      />
      <TextField
        label="Notes"
        value={notes}
        onChangeText={setNotes}
        placeholder="Anything worth remembering"
        optional
        multiline
      />

      {error ? <Text style={s.error}>{error}</Text> : null}

      <View style={s.submit}>
        <PrimaryButton
          label={submitLabel}
          onPress={handleSubmit}
          loading={submitting}
          disabled={!canSubmit}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  form: {
    gap: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rowItem: {
    flex: 1,
  },
  error: {
    fontSize: typography.sm,
    color: colors.danger,
  },
  submit: {
    marginTop: spacing.sm,
  },
});
