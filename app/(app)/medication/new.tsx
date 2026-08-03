import { useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../src/hooks/useAuth';
import { getPrimaryFamilyMember } from '../../../src/lib/reports';
import { createMedication } from '../../../src/lib/medications';
import FormScaffold from '../../../src/components/common/FormScaffold';
import MedicationForm, {
  medicationFormToFields,
  type MedicationFormValues,
} from '../../../src/components/medications/MedicationForm';

export default function NewMedicationScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (values: MedicationFormValues) => {
    if (!user) return;
    setSubmitting(true);

    const { member, error: memberErr } = await getPrimaryFamilyMember(user.id);
    if (memberErr || !member) {
      setSubmitting(false);
      Alert.alert('Could not save', 'We couldn’t find your profile. Please try again.');
      return;
    }

    const { error } = await createMedication({
      owner_id: user.id,
      family_member_id: member.id,
      ...medicationFormToFields(values),
    });

    setSubmitting(false);
    if (error) {
      Alert.alert('Could not save medication', error);
      return;
    }
    router.back();
  };

  return (
    <FormScaffold title="Add medication">
      <MedicationForm submitting={submitting} submitLabel="Save medication" onSubmit={handleSubmit} />
    </FormScaffold>
  );
}
