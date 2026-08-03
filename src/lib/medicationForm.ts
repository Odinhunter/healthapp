import { format } from 'date-fns';

export interface MedicationFormValues {
  name: string;
  generic_name: string;
  dosage: string;
  dosage_unit: string;
  frequency: string;
  start_date: Date;
  end_date: Date | null;
  with_food: boolean;
  is_active: boolean;
  prescribed_by: string;
  reason: string;
  notes: string;
}

// Normalises form values into the DB column shape shared by insert + update.
// Pure (no React Native imports) so it can be unit-tested directly.
export function medicationFormToFields(v: MedicationFormValues) {
  return {
    name: v.name.trim(),
    generic_name: v.generic_name.trim() || null,
    dosage: v.dosage.trim() || null,
    dosage_unit: v.dosage_unit.trim() || null,
    frequency: v.frequency.trim(),
    start_date: format(v.start_date, 'yyyy-MM-dd'),
    end_date: v.end_date ? format(v.end_date, 'yyyy-MM-dd') : null,
    with_food: v.with_food,
    is_active: v.is_active,
    prescribed_by: v.prescribed_by.trim() || null,
    reason: v.reason.trim() || null,
    notes: v.notes.trim() || null,
  };
}
