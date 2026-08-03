/**
 * Visit form mapper tests
 *
 * `visitFormToFields` is the only branching logic between the visit form UI
 * and the doctor_visits table: trimming, optional→null coalescing, the
 * comma-separated diagnosis split, and date formatting. A bug here silently
 * writes malformed health records, so the data-shaping is pinned down here.
 */
import { visitFormToFields, type VisitFormValues } from '../../src/lib/visitForm';

const base: VisitFormValues = {
  doctor_name: 'Dr. Sharma',
  specialty: '',
  clinic_hospital: '',
  visit_date: new Date('2026-03-14T09:00:00.000Z'),
  reason: '',
  diagnosis: '',
  followup_date: null,
  notes: '',
};

describe('visitFormToFields', () => {
  it('trims the doctor name and formats visit_date as yyyy-MM-dd', () => {
    const out = visitFormToFields({ ...base, doctor_name: '  Dr. Sharma  ' });
    expect(out.doctor_name).toBe('Dr. Sharma');
    expect(out.visit_date).toBe('2026-03-14');
  });

  it('coalesces blank optional text fields to null', () => {
    const out = visitFormToFields(base);
    expect(out.specialty).toBeNull();
    expect(out.clinic_hospital).toBeNull();
    expect(out.reason).toBeNull();
    expect(out.notes).toBeNull();
  });

  it('keeps non-blank optional fields (trimmed)', () => {
    const out = visitFormToFields({ ...base, specialty: '  Cardiologist ', notes: 'BP high' });
    expect(out.specialty).toBe('Cardiologist');
    expect(out.notes).toBe('BP high');
  });

  it('splits comma-separated diagnosis into a trimmed array, dropping empties', () => {
    const out = visitFormToFields({ ...base, diagnosis: 'Hypertension, , High cholesterol ,' });
    expect(out.diagnosis).toEqual(['Hypertension', 'High cholesterol']);
  });

  it('maps an empty diagnosis string to an empty array', () => {
    expect(visitFormToFields(base).diagnosis).toEqual([]);
  });

  it('formats followup_date when present and null when absent', () => {
    expect(visitFormToFields(base).followup_date).toBeNull();
    const out = visitFormToFields({
      ...base,
      followup_date: new Date('2026-04-01T00:00:00.000Z'),
    });
    expect(out.followup_date).toBe('2026-04-01');
  });
});
