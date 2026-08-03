import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { format } from 'date-fns';
import { useAuth } from '../../../src/hooks/useAuth';
import { getMedication, updateMedication, deleteMedication } from '../../../src/lib/medications';
import FormScaffold from '../../../src/components/common/FormScaffold';
import MedicationForm, {
  medicationFormToFields,
  type MedicationFormValues,
} from '../../../src/components/medications/MedicationForm';
import { colors, radius, spacing, typography } from '../../../src/constants/theme';
import type { MedicationRow } from '../../../src/types/database';

function dosageLine(m: MedicationRow): string {
  const dose = [m.dosage, m.dosage_unit].filter(Boolean).join(' ').trim();
  return [dose, m.frequency].filter(Boolean).join(' · ');
}

export default function MedicationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [med, setMed] = useState<MedicationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (!id) return;
        setLoading(true);
        const { data } = await getMedication(id);
        if (!cancelled) {
          setMed(data);
          setLoading(false);
        }
      })();
      return () => { cancelled = true; };
    }, [id]),
  );

  const handleSave = async (values: MedicationFormValues) => {
    if (!id) return;
    setSubmitting(true);
    const { error } = await updateMedication(id, medicationFormToFields(values));
    setSubmitting(false);
    if (error) {
      Alert.alert('Could not save changes', error);
      return;
    }
    const { data } = await getMedication(id);
    setMed(data);
    setEditing(false);
  };

  const confirmDelete = () => {
    Alert.alert('Delete this medication?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!id) return;
          const { error } = await deleteMedication(id);
          if (error) {
            Alert.alert('Could not delete', error);
            return;
          }
          router.back();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <FormScaffold title="Medication">
        <View style={s.center}><ActivityIndicator color={colors.primary} /></View>
      </FormScaffold>
    );
  }

  if (!med) {
    return (
      <FormScaffold title="Medication">
        <View style={s.center}>
          <Text style={s.errorText}>This medication could not be found.</Text>
        </View>
      </FormScaffold>
    );
  }

  if (editing) {
    return (
      <FormScaffold title="Edit medication">
        <MedicationForm
          submitting={submitting}
          submitLabel="Save changes"
          onSubmit={handleSave}
          initial={{
            name: med.name,
            generic_name: med.generic_name ?? '',
            dosage: med.dosage ?? '',
            dosage_unit: med.dosage_unit ?? '',
            frequency: med.frequency,
            start_date: new Date(med.start_date),
            end_date: med.end_date ? new Date(med.end_date) : null,
            with_food: med.with_food,
            is_active: med.is_active,
            prescribed_by: med.prescribed_by ?? '',
            reason: med.reason ?? '',
            notes: med.notes ?? '',
          }}
        />
      </FormScaffold>
    );
  }

  return (
    <FormScaffold title={med.name}>
      <View style={s.body}>
        <Field label="Medication" value={med.name} />
        {med.generic_name ? <Field label="Generic name" value={med.generic_name} /> : null}
        {dosageLine(med) ? <Field label="Dosage" value={dosageLine(med)} /> : null}
        <Field label="Take with food" value={med.with_food ? 'Yes' : 'No'} />
        <Field label="Status" value={med.is_active ? 'Active' : 'Stopped'} />
        <Field label="Start date" value={format(new Date(med.start_date), 'd MMMM yyyy')} />
        {med.end_date ? (
          <Field label="End date" value={format(new Date(med.end_date), 'd MMMM yyyy')} />
        ) : null}
        {med.prescribed_by ? <Field label="Prescribed by" value={med.prescribed_by} /> : null}
        {med.reason ? <Field label="Reason" value={med.reason} /> : null}
        {med.notes ? <Field label="Notes" value={med.notes} /> : null}

        <Pressable style={s.editButton} onPress={() => setEditing(true)}>
          <Text style={s.editButtonText}>Edit medication</Text>
        </Pressable>
        <Pressable style={s.deleteButton} onPress={confirmDelete}>
          <Text style={s.deleteButtonText}>Delete medication</Text>
        </Pressable>
      </View>
    </FormScaffold>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <Text style={s.fieldValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xxxxl,
  },
  errorText: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  body: {
    gap: spacing.lg,
  },
  field: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: typography.xs,
    fontWeight: '600',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  fieldValue: {
    fontSize: typography.base,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  editButton: {
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  editButtonText: {
    color: '#fff',
    fontSize: typography.base,
    fontWeight: '600',
  },
  deleteButton: {
    height: 52,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: colors.danger,
    fontSize: typography.base,
    fontWeight: '600',
  },
});
