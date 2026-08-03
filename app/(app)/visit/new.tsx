import { useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../src/hooks/useAuth';
import { getPrimaryFamilyMember } from '../../../src/lib/reports';
import { createVisit } from '../../../src/lib/visits';
import FormScaffold from '../../../src/components/common/FormScaffold';
import VisitForm, {
  visitFormToFields,
  type VisitFormValues,
} from '../../../src/components/visits/VisitForm';

export default function NewVisitScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (values: VisitFormValues) => {
    if (!user) return;
    setSubmitting(true);

    const { member, error: memberErr } = await getPrimaryFamilyMember(user.id);
    if (memberErr || !member) {
      setSubmitting(false);
      Alert.alert('Could not save', 'We couldn’t find your profile. Please try again.');
      return;
    }

    const { error } = await createVisit({
      owner_id: user.id,
      family_member_id: member.id,
      ...visitFormToFields(values),
    });

    setSubmitting(false);
    if (error) {
      Alert.alert('Could not save visit', error);
      return;
    }
    router.back();
  };

  return (
    <FormScaffold title="Log a visit">
      <VisitForm submitting={submitting} submitLabel="Save visit" onSubmit={handleSubmit} />
    </FormScaffold>
  );
}
