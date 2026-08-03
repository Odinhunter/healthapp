import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import PrimaryButton from '../../src/components/PrimaryButton';
import { supabase } from '../../src/lib/supabase';
import { colors, radius, spacing, typography } from '../../src/constants/theme';
import type { FamilyMemberRow } from '../../src/types/database';

type Gender = FamilyMemberRow['gender'];
type BloodGroup = FamilyMemberRow['blood_group'];

const GENDERS: { label: string; value: NonNullable<Gender> }[] = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' },
];

const BLOOD_GROUPS: NonNullable<BloodGroup>[] = [
  'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-',
];

export default function CreateProfileScreen() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [nameFocused, setNameFocused] = useState(false);
  const [dob, setDob] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState<Gender>(null);
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error: insertError } = await supabase.from('family_members').insert({
        owner_id: user.id,
        full_name: name.trim(),
        relationship: 'self',
        is_primary: true,
        date_of_birth: dob ? format(dob, 'yyyy-MM-dd') : null,
        gender: gender ?? undefined,
        blood_group: bloodGroup ?? undefined,
        avatar_color: colors.primary,
      });
      if (insertError) throw insertError;

      await supabase
        .from('profiles')
        .update({ full_name: name.trim() })
        .eq('id', user.id);

      router.replace('/(app)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderDatePicker = () => {
    if (!showDatePicker) return null;

    if (Platform.OS === 'android') {
      return (
        <DateTimePicker
          value={dob ?? new Date(1990, 0, 1)}
          mode="date"
          display="default"
          maximumDate={new Date()}
          minimumDate={new Date(1900, 0, 1)}
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (event.type === 'set' && selectedDate) setDob(selectedDate);
          }}
        />
      );
    }

    // iOS — show in modal
    return (
      <Modal transparent animationType="slide" visible={showDatePicker}>
        <View style={styles.dateModalOverlay}>
          <View style={styles.dateModalContent}>
            <View style={styles.dateModalHeader}>
              <Pressable onPress={() => setShowDatePicker(false)}>
                <Text style={styles.dateModalDone}>Done</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={dob ?? new Date(1990, 0, 1)}
              mode="date"
              display="spinner"
              maximumDate={new Date()}
              minimumDate={new Date(1900, 0, 1)}
              onChange={(event, selectedDate) => {
                if (event.type === 'set' && selectedDate) setDob(selectedDate);
              }}
            />
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.headline}>Let's set up your profile.</Text>
          <Text style={styles.subtext}>This is your personal health record.</Text>

          <View style={styles.form}>
            {/* Full name */}
            <View>
              <Text style={styles.fieldLabel}>Your full name</Text>
              <TextInput
                style={[styles.textInput, nameFocused && styles.textInputFocused]}
                value={name}
                onChangeText={(t) => { setName(t); setError(null); }}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
                placeholder="Full name"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="words"
                returnKeyType="done"
              />
            </View>

            {/* Date of birth */}
            <View>
              <Text style={styles.fieldLabel}>Date of birth</Text>
              <Pressable
                style={[styles.textInput, styles.pressableRow]}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={dob ? styles.dateValue : styles.datePlaceholder}>
                  {dob ? format(dob, 'd MMMM yyyy') : 'Select date'}
                </Text>
              </Pressable>
            </View>

            {/* Gender */}
            <View>
              <Text style={styles.fieldLabel}>Gender</Text>
              <View style={styles.pillRow}>
                {GENDERS.map((g) => (
                  <Pressable
                    key={g.value}
                    style={[
                      styles.pill,
                      styles.genderPill,
                      gender === g.value && styles.pillSelected,
                    ]}
                    onPress={() => setGender(gender === g.value ? null : g.value)}
                  >
                    <Text style={[styles.pillText, gender === g.value && styles.pillTextSelected]}>
                      {g.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Blood group */}
            <View>
              <Text style={styles.fieldLabel}>Blood group</Text>
              <View style={styles.bloodGroupGrid}>
                {BLOOD_GROUPS.map((bg) => (
                  <Pressable
                    key={bg}
                    style={[
                      styles.pill,
                      styles.bloodPill,
                      bloodGroup === bg && styles.pillSelected,
                    ]}
                    onPress={() => setBloodGroup(bloodGroup === bg ? null : bg)}
                  >
                    <Text style={[styles.pillText, bloodGroup === bg && styles.pillTextSelected]}>
                      {bg}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton
            label="Continue"
            onPress={handleCreate}
            disabled={name.trim().length === 0}
            loading={loading}
          />
        </View>
      </KeyboardAvoidingView>

      {renderDatePicker()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xxxl,
  },
  headline: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtext: {
    fontSize: typography.base,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  form: {
    marginTop: spacing.xxxl,
    gap: spacing.lg,
  },
  fieldLabel: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  textInput: {
    height: 58,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    fontSize: typography.md,
    color: colors.textPrimary,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
  },
  textInputFocused: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  pressableRow: {
    justifyContent: 'center',
  },
  dateValue: {
    fontSize: typography.md,
    color: colors.textPrimary,
  },
  datePlaceholder: {
    fontSize: typography.md,
    color: colors.textTertiary,
  },
  pillRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  bloodGroupGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pill: {
    height: 40,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderPill: {
    width: 80,
  },
  bloodPill: {
    width: 52,
  },
  pillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillText: {
    fontSize: typography.sm,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  pillTextSelected: {
    color: '#fff',
  },
  error: {
    fontSize: typography.sm,
    color: colors.danger,
    marginTop: spacing.xs,
  },
  footer: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xl,
    paddingTop: spacing.md,
  },
  dateModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  dateModalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing.xxxl,
  },
  dateModalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  dateModalDone: {
    fontSize: typography.md,
    color: colors.primary,
    fontWeight: '600',
  },
});
