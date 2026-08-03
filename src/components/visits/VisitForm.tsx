import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import PrimaryButton from '../PrimaryButton';
import TextField from '../forms/TextField';
import DateField from '../forms/DateField';
import { colors, spacing, typography } from '../../constants/theme';
import { visitFormToFields, type VisitFormValues } from '../../lib/visitForm';

// Re-exported so screens can import the form + its helpers from one place.
export { visitFormToFields };
export type { VisitFormValues };

interface Props {
  initial?: Partial<VisitFormValues>;
  submitting: boolean;
  submitLabel: string;
  onSubmit: (values: VisitFormValues) => void;
}

export default function VisitForm({ initial, submitting, submitLabel, onSubmit }: Props) {
  const [doctorName, setDoctorName] = useState(initial?.doctor_name ?? '');
  const [specialty, setSpecialty] = useState(initial?.specialty ?? '');
  const [clinic, setClinic] = useState(initial?.clinic_hospital ?? '');
  const [visitDate, setVisitDate] = useState<Date>(initial?.visit_date ?? new Date());
  const [reason, setReason] = useState(initial?.reason ?? '');
  const [diagnosis, setDiagnosis] = useState(initial?.diagnosis ?? '');
  const [followupDate, setFollowupDate] = useState<Date | null>(initial?.followup_date ?? null);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!doctorName.trim()) {
      setError('Please enter the doctor’s name.');
      return;
    }
    setError(null);
    onSubmit({
      doctor_name: doctorName,
      specialty,
      clinic_hospital: clinic,
      visit_date: visitDate,
      reason,
      diagnosis,
      followup_date: followupDate,
      notes,
    });
  };

  return (
    <View style={s.form}>
      <TextField
        label="Doctor’s name"
        value={doctorName}
        onChangeText={(t) => { setDoctorName(t); setError(null); }}
        placeholder="Dr. Sharma"
        autoCapitalize="words"
      />
      <TextField
        label="Specialty"
        value={specialty}
        onChangeText={setSpecialty}
        placeholder="Cardiologist"
        optional
        autoCapitalize="words"
      />
      <TextField
        label="Clinic / hospital"
        value={clinic}
        onChangeText={setClinic}
        placeholder="Apollo Hospital"
        optional
        autoCapitalize="words"
      />
      <DateField
        label="Visit date"
        value={visitDate}
        onChange={setVisitDate}
        maximumDate={new Date()}
      />
      <TextField
        label="Reason for visit"
        value={reason}
        onChangeText={setReason}
        placeholder="Routine check-up"
        optional
      />
      <TextField
        label="Diagnosis"
        value={diagnosis}
        onChangeText={setDiagnosis}
        placeholder="Hypertension, High cholesterol"
        hint="Separate multiple diagnoses with commas"
        optional
      />
      <DateField
        label="Follow-up date"
        value={followupDate}
        onChange={setFollowupDate}
        optional
        placeholder="No follow-up scheduled"
        onClear={() => setFollowupDate(null)}
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
          disabled={doctorName.trim().length === 0}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  form: {
    gap: spacing.lg,
  },
  error: {
    fontSize: typography.sm,
    color: colors.danger,
  },
  submit: {
    marginTop: spacing.sm,
  },
});
