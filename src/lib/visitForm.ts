import { format } from 'date-fns';

export interface VisitFormValues {
  doctor_name: string;
  specialty: string;
  clinic_hospital: string;
  visit_date: Date;
  reason: string;
  diagnosis: string; // comma-separated; split into text[] on save
  followup_date: Date | null;
  notes: string;
}

// Normalises form values into the DB column shape shared by insert + update.
// Pure (no React Native imports) so it can be unit-tested directly.
export function visitFormToFields(v: VisitFormValues) {
  return {
    doctor_name: v.doctor_name.trim(),
    specialty: v.specialty.trim() || null,
    clinic_hospital: v.clinic_hospital.trim() || null,
    visit_date: format(v.visit_date, 'yyyy-MM-dd'),
    reason: v.reason.trim() || null,
    diagnosis: v.diagnosis.split(',').map((d) => d.trim()).filter(Boolean),
    followup_date: v.followup_date ? format(v.followup_date, 'yyyy-MM-dd') : null,
    notes: v.notes.trim() || null,
  };
}
