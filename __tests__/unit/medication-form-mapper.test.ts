/**
 * Medication form mapper tests
 *
 * `medicationFormToFields` shapes the medication form into the medications
 * table: trimming, optional→null coalescing, boolean pass-through, and date
 * formatting. `name` and `frequency` are required (validated in the form), so
 * they are always trimmed strings here, never null.
 */
import { medicationFormToFields, type MedicationFormValues } from '../../src/lib/medicationForm';

const base: MedicationFormValues = {
  name: 'Metformin',
  generic_name: '',
  dosage: '',
  dosage_unit: '',
  frequency: 'Twice daily',
  start_date: new Date('2026-01-10T00:00:00.000Z'),
  end_date: null,
  with_food: false,
  is_active: true,
  prescribed_by: '',
  reason: '',
  notes: '',
};

describe('medicationFormToFields', () => {
  it('trims required name/frequency and formats start_date', () => {
    const out = medicationFormToFields({ ...base, name: '  Metformin ', frequency: ' Twice daily ' });
    expect(out.name).toBe('Metformin');
    expect(out.frequency).toBe('Twice daily');
    expect(out.start_date).toBe('2026-01-10');
  });

  it('coalesces blank optional text fields to null', () => {
    const out = medicationFormToFields(base);
    expect(out.generic_name).toBeNull();
    expect(out.dosage).toBeNull();
    expect(out.dosage_unit).toBeNull();
    expect(out.prescribed_by).toBeNull();
    expect(out.reason).toBeNull();
    expect(out.notes).toBeNull();
  });

  it('passes booleans through unchanged', () => {
    const out = medicationFormToFields({ ...base, with_food: true, is_active: false });
    expect(out.with_food).toBe(true);
    expect(out.is_active).toBe(false);
  });

  it('formats end_date when present and null when ongoing', () => {
    expect(medicationFormToFields(base).end_date).toBeNull();
    const out = medicationFormToFields({
      ...base,
      end_date: new Date('2026-02-20T00:00:00.000Z'),
    });
    expect(out.end_date).toBe('2026-02-20');
  });

  it('keeps dosage and unit as separate trimmed fields', () => {
    const out = medicationFormToFields({ ...base, dosage: ' 500 ', dosage_unit: ' mg ' });
    expect(out.dosage).toBe('500');
    expect(out.dosage_unit).toBe('mg');
  });
});
