import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { format } from 'date-fns';
import { useAuth } from '../../../src/hooks/useAuth';
import { getVisit, updateVisit, deleteVisit } from '../../../src/lib/visits';
import FormScaffold from '../../../src/components/common/FormScaffold';
import VisitForm, {
  visitFormToFields,
  type VisitFormValues,
} from '../../../src/components/visits/VisitForm';
import { colors, radius, spacing, typography } from '../../../src/constants/theme';
import type { DoctorVisitRow } from '../../../src/types/database';

export default function VisitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [visit, setVisit] = useState<DoctorVisitRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (!id) return;
        setLoading(true);
        const { data } = await getVisit(id);
        if (!cancelled) {
          setVisit(data);
          setLoading(false);
        }
      })();
      return () => { cancelled = true; };
    }, [id]),
  );

  const handleSave = async (values: VisitFormValues) => {
    if (!id) return;
    setSubmitting(true);
    const { error } = await updateVisit(id, visitFormToFields(values));
    setSubmitting(false);
    if (error) {
      Alert.alert('Could not save changes', error);
      return;
    }
    const { data } = await getVisit(id);
    setVisit(data);
    setEditing(false);
  };

  const confirmDelete = () => {
    Alert.alert('Delete this visit?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!id) return;
          const { error } = await deleteVisit(id);
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
      <FormScaffold title="Visit">
        <View style={s.center}><ActivityIndicator color={colors.primary} /></View>
      </FormScaffold>
    );
  }

  if (!visit) {
    return (
      <FormScaffold title="Visit">
        <View style={s.center}>
          <Text style={s.errorText}>This visit could not be found.</Text>
        </View>
      </FormScaffold>
    );
  }

  if (editing) {
    return (
      <FormScaffold title="Edit visit">
        <VisitForm
          submitting={submitting}
          submitLabel="Save changes"
          onSubmit={handleSave}
          initial={{
            doctor_name: visit.doctor_name,
            specialty: visit.specialty ?? '',
            clinic_hospital: visit.clinic_hospital ?? '',
            visit_date: new Date(visit.visit_date),
            reason: visit.reason ?? '',
            diagnosis: visit.diagnosis.join(', '),
            followup_date: visit.followup_date ? new Date(visit.followup_date) : null,
            notes: visit.notes ?? '',
          }}
        />
      </FormScaffold>
    );
  }

  return (
    <FormScaffold title={visit.doctor_name}>
      <View style={s.body}>
        <Field label="Doctor" value={visit.doctor_name} />
        {visit.specialty ? <Field label="Specialty" value={visit.specialty} /> : null}
        {visit.clinic_hospital ? <Field label="Clinic / hospital" value={visit.clinic_hospital} /> : null}
        <Field label="Visit date" value={format(new Date(visit.visit_date), 'd MMMM yyyy')} />
        {visit.reason ? <Field label="Reason" value={visit.reason} /> : null}
        {visit.diagnosis.length > 0 ? (
          <Field label="Diagnosis" value={visit.diagnosis.join(', ')} />
        ) : null}
        {visit.followup_date ? (
          <Field label="Follow-up" value={format(new Date(visit.followup_date), 'd MMMM yyyy')} />
        ) : null}
        {visit.notes ? <Field label="Notes" value={visit.notes} /> : null}

        <Pressable style={s.editButton} onPress={() => setEditing(true)}>
          <Text style={s.editButtonText}>Edit visit</Text>
        </Pressable>
        <Pressable style={s.deleteButton} onPress={confirmDelete}>
          <Text style={s.deleteButtonText}>Delete visit</Text>
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
